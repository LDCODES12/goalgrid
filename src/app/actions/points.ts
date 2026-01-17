"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { addDays } from "date-fns"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getLocalDateKey, getWeekKey, getWeekStart, getWeekEnd } from "@/lib/time"
import {
  GoalForPoints,
  WEEKLY_POINTS_CEILING,
  computeDailyGoalProgress,
  computeWeeklyGoalProgress,
  goalShare,
  deltaScore,
  isGoalActiveForWeek,
} from "@/lib/points"

/**
 * Backfill points for a user's historical check-ins.
 * This is idempotent - it won't create duplicate ledger entries due to the unique constraint.
 * 
 * Strategy: Process check-ins week by week, in chronological order within each week,
 * to ensure accurate progress calculations.
 */
export async function backfillUserPointsAction() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })
  if (!user) return { ok: false, error: "User not found" }

  // Get all check-ins for this user, ordered by timestamp
  const allCheckIns = await prisma.checkIn.findMany({
    where: { userId },
    orderBy: { timestamp: "asc" },
    include: { goal: true },
  })

  if (allCheckIns.length === 0) {
    return { ok: true, message: "No check-ins to process", pointsAwarded: 0 }
  }

  // Get all goals for context
  const allGoals = await prisma.goal.findMany({
    where: { ownerId: userId },
    select: { id: true, cadenceType: true, dailyTarget: true, weeklyTarget: true, active: true, createdAt: true },
  })

  // Group check-ins by week
  const checkInsByWeek = new Map<string, typeof allCheckIns>()
  for (const checkIn of allCheckIns) {
    const week = checkIn.weekKey
    if (!checkInsByWeek.has(week)) {
      checkInsByWeek.set(week, [])
    }
    checkInsByWeek.get(week)!.push(checkIn)
  }

  // Sort weeks chronologically
  const sortedWeeks = Array.from(checkInsByWeek.keys()).sort()

  let totalPointsMilli = 0
  const ledgerEntries: Array<{
    userId: string
    goalId: string
    weekKey: string
    localDate: string
    pointsMilli: number
    reason: "CHECKIN_POINTS"
    sourceId: string
  }> = []

  for (const weekKey of sortedWeeks) {
    const weekCheckIns = checkInsByWeek.get(weekKey)!
    
    // Parse the weekKey to get week dates (format: YYYY-Www)
    const [yearStr, weekNumStr] = weekKey.split("-W")
    const year = parseInt(yearStr)
    const weekNum = parseInt(weekNumStr)
    
    // Calculate week start date (Monday of that week)
    const jan1 = new Date(year, 0, 1)
    const jan1Day = jan1.getDay() || 7 // Convert Sunday (0) to 7
    const daysToFirstMonday = jan1Day <= 1 ? 1 - jan1Day : 8 - jan1Day
    const firstMonday = new Date(year, 0, 1 + daysToFirstMonday)
    const weekStart = new Date(firstMonday)
    weekStart.setDate(firstMonday.getDate() + (weekNum - 1) * 7)
    const weekEnd = addDays(weekStart, 6)

    // Generate week dates
    const weekDates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i)
      weekDates.push(d.toISOString().split("T")[0])
    }

    // Determine active goals for this week
    const goalCheckInCounts = new Map<string, number>()
    for (const ci of weekCheckIns) {
      goalCheckInCounts.set(ci.goalId, (goalCheckInCounts.get(ci.goalId) ?? 0) + 1)
    }

    const activeGoalsForWeek: GoalForPoints[] = allGoals.filter((g) =>
      isGoalActiveForWeek(
        g as GoalForPoints,
        weekEnd,
        (goalCheckInCounts.get(g.id) ?? 0) > 0
      )
    ) as GoalForPoints[]

    // Track progress per goal as we process check-ins
    const goalProgress = new Map<string, { byDate: Map<string, number>; total: number }>()
    for (const goal of activeGoalsForWeek) {
      goalProgress.set(goal.id, { byDate: new Map(), total: 0 })
    }

    // Track points earned this week
    let weekPointsMilli = 0

    // Process check-ins in order
    for (const checkIn of weekCheckIns) {
      const goal = allGoals.find((g) => g.id === checkIn.goalId)
      if (!goal) continue

      const goalForPoints: GoalForPoints = goal as GoalForPoints
      const progress = goalProgress.get(goal.id) ?? { byDate: new Map(), total: 0 }

      // Calculate P_before
      let P_before: number
      if (goal.cadenceType === "DAILY") {
        P_before = computeDailyGoalProgress(progress.byDate, goal.dailyTarget, weekDates)
      } else {
        P_before = computeWeeklyGoalProgress(progress.total, goal.weeklyTarget ?? 1)
      }

      // Update progress
      const dateCount = progress.byDate.get(checkIn.localDateKey) ?? 0
      progress.byDate.set(checkIn.localDateKey, dateCount + 1)
      progress.total += 1
      goalProgress.set(goal.id, progress)

      // Calculate P_after
      let P_after: number
      if (goal.cadenceType === "DAILY") {
        P_after = computeDailyGoalProgress(progress.byDate, goal.dailyTarget, weekDates)
      } else {
        P_after = computeWeeklyGoalProgress(progress.total, goal.weeklyTarget ?? 1)
      }

      // Calculate points (simplified - no streak bonus for backfill)
      const share = goalShare(goalForPoints, activeGoalsForWeek)
      const basePointsMilli = Math.round(share * deltaScore(P_before, P_after) * 1000)

      // Clamp to remaining ceiling
      const remainingMilli = WEEKLY_POINTS_CEILING * 1000 - weekPointsMilli
      const pointsMilli = Math.max(0, Math.min(basePointsMilli, remainingMilli))

      if (pointsMilli > 0) {
        ledgerEntries.push({
          userId,
          goalId: goal.id,
          weekKey,
          localDate: checkIn.localDateKey,
          pointsMilli,
          reason: "CHECKIN_POINTS",
          sourceId: checkIn.id,
        })
        weekPointsMilli += pointsMilli
        totalPointsMilli += pointsMilli
      }
    }
  }

  // Insert ledger entries in batches, skipping duplicates
  let insertedCount = 0
  for (const entry of ledgerEntries) {
    try {
      await prisma.pointLedger.create({
        data: entry,
      })
      insertedCount++
    } catch (e: unknown) {
      // Unique constraint violation means it already exists - skip
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        continue
      }
      throw e
    }
  }

  // Recalculate user totals from ledger
  const lifetimeTotal = await prisma.pointLedger.aggregate({
    where: { userId },
    _sum: { pointsMilli: true },
  })

  const currentWeekKey = getWeekKey(new Date(), user.timezone)
  const weekTotal = await prisma.pointLedger.aggregate({
    where: { userId, weekKey: currentWeekKey },
    _sum: { pointsMilli: true },
  })

  await prisma.user.update({
    where: { id: userId },
    data: {
      pointsLifetimeMilli: lifetimeTotal._sum.pointsMilli ?? 0,
      pointsWeekMilli: weekTotal._sum.pointsMilli ?? 0,
      pointsWeekKey: currentWeekKey,
    },
  })

  revalidatePath("/dashboard")
  revalidatePath("/goals")

  return {
    ok: true,
    message: `Backfilled ${insertedCount} new point entries`,
    pointsAwarded: Math.floor(totalPointsMilli / 1000),
    totalLifetimePoints: Math.floor((lifetimeTotal._sum.pointsMilli ?? 0) / 1000),
  }
}

/**
 * Recalculate user point totals from ledger.
 * Useful if totals get out of sync.
 */
export async function recalculateUserPointsAction() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })
  if (!user) return { ok: false, error: "User not found" }

  const currentWeekKey = getWeekKey(new Date(), user.timezone)

  const lifetimeTotal = await prisma.pointLedger.aggregate({
    where: { userId },
    _sum: { pointsMilli: true },
  })

  const weekTotal = await prisma.pointLedger.aggregate({
    where: { userId, weekKey: currentWeekKey },
    _sum: { pointsMilli: true },
  })

  await prisma.user.update({
    where: { id: userId },
    data: {
      pointsLifetimeMilli: lifetimeTotal._sum.pointsMilli ?? 0,
      pointsWeekMilli: weekTotal._sum.pointsMilli ?? 0,
      pointsWeekKey: currentWeekKey,
    },
  })

  revalidatePath("/dashboard")
  revalidatePath("/goals")

  return {
    ok: true,
    lifetimePoints: Math.floor((lifetimeTotal._sum.pointsMilli ?? 0) / 1000),
    weekPoints: Math.floor((weekTotal._sum.pointsMilli ?? 0) / 1000),
  }
}
