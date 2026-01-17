"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { parseISO, addDays } from "date-fns"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkInSchema } from "@/lib/validators"
import { getLocalDateKey, getWeekKey, getWeekStart, getWeekEnd } from "@/lib/time"
import { summarizeDailyCheckIns, computeGracefulStreak } from "@/lib/scoring"
import {
  GoalForPoints,
  computeDailyGoalProgress,
  computeWeeklyGoalProgress,
  calculatePointsToAward,
  isGoalActiveForWeek,
  milliToDisplay,
} from "@/lib/points"

/**
 * Undo the most recent check-in for a goal today
 * For single-target goals: removes the check-in
 * For multi-target goals: removes the most recent one (decrements count)
 */
export async function undoCheckInAction(goalId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) return { ok: false, error: "User not found." }

  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      ownerId: session.user.id,
    },
  })
  if (!goal) return { ok: false, error: "Goal not found or not yours." }

  const localDateKey = getLocalDateKey(new Date(), user.timezone)

  // Find today's check-ins, ordered by most recent first
  const todayCheckIns = await prisma.checkIn.findMany({
    where: {
      goalId: goal.id,
      userId: session.user.id,
      localDateKey,
    },
    orderBy: { timestamp: "desc" },
  })

  if (todayCheckIns.length === 0) {
    return { ok: false, error: "No check-ins to undo today." }
  }

  // Delete the most recent check-in
  await prisma.checkIn.delete({
    where: { id: todayCheckIns[0].id },
  })

  revalidatePath("/dashboard")
  revalidatePath("/group")
  revalidatePath("/goals")
  revalidatePath(`/goals/${goal.id}`)

  const newCount = todayCheckIns.length - 1
  return { 
    ok: true, 
    todayCount: newCount,
    dailyTarget: goal.dailyTarget ?? 1,
  }
}

export async function checkInGoalAction(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const parsed = checkInSchema.safeParse({
    goalId: formData.get("goalId"),
  })
  if (!parsed.success) return { ok: false, error: "Invalid goal." }

  // Check if this is a partial completion
  const isPartial = formData.get("isPartial") === "true"

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) return { ok: false, error: "User not found." }

  const goal = await prisma.goal.findFirst({
    where: {
      id: parsed.data.goalId,
      ownerId: session.user.id,
    },
  })
  if (!goal) return { ok: false, error: "Goal not found or not yours." }

  const now = new Date()
  const localDateKey = getLocalDateKey(now, user.timezone)
  const weekKey = getWeekKey(now, user.timezone)

  // Count today's check-ins for this goal
  const todayCheckIns = await prisma.checkIn.findMany({
    where: {
      goalId: goal.id,
      userId: session.user.id,
      localDateKey,
    },
  })
  
  const dailyTarget = goal.dailyTarget ?? 1
  const todayCount = todayCheckIns.length
  
  // For single-target goals, handle partial upgrade
  if (dailyTarget === 1) {
    const existing = todayCheckIns[0]
    if (existing) {
      if (existing.isPartial && !isPartial) {
        await prisma.checkIn.update({
          where: { id: existing.id },
          data: { isPartial: false, timestamp: now },
        })
        revalidatePath("/dashboard")
        revalidatePath("/group")
        revalidatePath("/goals")
        revalidatePath(`/goals/${goal.id}`)
        return { ok: true, upgraded: true, pointsEarned: 0, streakBonusApplied: false }
      }
      return { ok: false, error: "Already completed today." }
    }
  } else {
    if (todayCount >= dailyTarget) {
      return { ok: false, error: `Already completed ${dailyTarget}x today.` }
    }
  }

  // === TRANSACTION: Create check-in and award points ===
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the check-in
    const checkIn = await tx.checkIn.create({
      data: {
        goalId: goal.id,
        userId: session.user.id,
        timestamp: now,
        localDateKey,
        weekKey,
        isPartial: dailyTarget === 1 ? isPartial : false,
      },
    })

    // 2. Get all check-ins for this goal this week (for progress calculation)
    const weekCheckIns = await tx.checkIn.findMany({
      where: {
        goalId: goal.id,
        userId: session.user.id,
        weekKey,
      },
      select: { localDateKey: true },
    })

    // 3. Compute P_before and P_after
    const weekStart = getWeekStart(now, user.timezone)
    const weekDates: string[] = []
    for (let i = 0; i < 7; i++) {
      weekDates.push(getLocalDateKey(addDays(weekStart, i), user.timezone))
    }

    // Group check-ins by date
    const checkInsByDate = new Map<string, number>()
    for (const ci of weekCheckIns) {
      checkInsByDate.set(ci.localDateKey, (checkInsByDate.get(ci.localDateKey) ?? 0) + 1)
    }

    // P_after includes the new check-in, P_before excludes it
    const checkInsByDateBefore = new Map(checkInsByDate)
    const currentDayCount = checkInsByDateBefore.get(localDateKey) ?? 0
    if (currentDayCount > 0) {
      checkInsByDateBefore.set(localDateKey, currentDayCount - 1)
    }

    let P_before: number, P_after: number
    if (goal.cadenceType === "DAILY") {
      P_before = computeDailyGoalProgress(checkInsByDateBefore, dailyTarget, weekDates)
      P_after = computeDailyGoalProgress(checkInsByDate, dailyTarget, weekDates)
    } else {
      const weeklyTarget = goal.weeklyTarget ?? 1
      P_before = computeWeeklyGoalProgress(weekCheckIns.length - 1, weeklyTarget)
      P_after = computeWeeklyGoalProgress(weekCheckIns.length, weeklyTarget)
    }

    // 4. Get active goals for the week
    const allGoals = await tx.goal.findMany({
      where: { ownerId: session.user.id, active: true },
      select: { id: true, cadenceType: true, dailyTarget: true, weeklyTarget: true, active: true, createdAt: true },
    })

    // Get check-in counts for each goal this week
    const goalCheckInCounts = await tx.checkIn.groupBy({
      by: ["goalId"],
      where: { userId: session.user.id, weekKey },
      _count: true,
    })
    const countsByGoal = new Map(goalCheckInCounts.map((g) => [g.goalId, g._count]))

    // Filter to active-for-week
    const weekEnd = getWeekEnd(now, user.timezone)
    const activeGoals: GoalForPoints[] = allGoals.filter((g) =>
      isGoalActiveForWeek(
        g as GoalForPoints,
        weekEnd,
        (countsByGoal.get(g.id) ?? 0) > 0
      )
    ) as GoalForPoints[]

    // 5. Calculate streak for multiplier
    const allCheckIns = await tx.checkIn.findMany({
      where: { goalId: goal.id, userId: session.user.id },
      select: { localDateKey: true },
    })
    const dateKeys = summarizeDailyCheckIns(allCheckIns)
    const gracefulStreak = computeGracefulStreak(dateKeys, localDateKey, user.timezone, goal.streakFreezes, dailyTarget)
    const streakDays = gracefulStreak.currentStreak
    const freezeUsedRecently = gracefulStreak.freezesUsed > 0

    // 6. Get points already earned this week
    const alreadyEarned = await tx.pointLedger.aggregate({
      where: { userId: session.user.id, weekKey },
      _sum: { pointsMilli: true },
    })
    const pointsAlreadyEarnedMilli = alreadyEarned._sum.pointsMilli ?? 0

    // 7. Calculate points to award
    const goalForPoints: GoalForPoints = {
      id: goal.id,
      cadenceType: goal.cadenceType,
      dailyTarget: goal.dailyTarget,
      weeklyTarget: goal.weeklyTarget,
      active: goal.active,
      createdAt: goal.createdAt,
    }

    const { pointsMilli, streakBonusApplied } = calculatePointsToAward(
      goalForPoints,
      P_before,
      P_after,
      activeGoals,
      streakDays,
      freezeUsedRecently,
      pointsAlreadyEarnedMilli
    )

    // 8. Insert ledger entry (idempotent) and update user totals
    if (pointsMilli > 0) {
      await tx.pointLedger.create({
        data: {
          userId: session.user.id,
          goalId: goal.id,
          weekKey,
          localDate: localDateKey,
          pointsMilli,
          reason: "CHECKIN_POINTS",
          sourceId: checkIn.id,
        },
      })

      // Update user totals
      const shouldResetWeek = user.pointsWeekKey !== weekKey
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          pointsLifetimeMilli: { increment: pointsMilli },
          pointsWeekMilli: shouldResetWeek ? pointsMilli : { increment: pointsMilli },
          pointsWeekKey: weekKey,
        },
      })
    }

    // Check for streak milestone
    let streakMilestone: number | null = null
    if ([7, 14, 30].includes(streakDays)) {
      streakMilestone = streakDays
    }

    return {
      checkIn,
      pointsMilli,
      streakBonusApplied,
      streakMilestone,
      newCount: todayCount + 1,
    }
  })

  revalidatePath("/dashboard")
  revalidatePath("/group")
  revalidatePath("/goals")
  revalidatePath(`/goals/${goal.id}`)

  return {
    ok: true,
    streakMilestone: result.streakMilestone,
    todayCount: result.newCount,
    dailyTarget,
    isComplete: result.newCount >= dailyTarget,
    pointsEarned: milliToDisplay(result.pointsMilli),
    streakBonusApplied: result.streakBonusApplied,
  }
}

/**
 * Log check-in(s) for a specific past date
 * Sets the completion count for that date (replaces existing)
 */
export async function logHistoricalCheckInAction({
  goalId,
  date,
  count,
}: {
  goalId: string
  date: string // YYYY-MM-DD format
  count: number
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) return { ok: false, error: "User not found." }

  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      ownerId: session.user.id,
    },
  })
  if (!goal) return { ok: false, error: "Goal not found or not yours." }

  // Validate date format
  const targetDate = parseISO(date)
  if (isNaN(targetDate.getTime())) {
    return { ok: false, error: "Invalid date format." }
  }

  // Get today's date in user's timezone
  const todayKey = getLocalDateKey(new Date(), user.timezone)
  
  // Validate: date must be before today
  if (date >= todayKey) {
    return { ok: false, error: "Can only log activity for past dates." }
  }

  // Note: We intentionally allow dates before the goal was created
  // This lets users backfill historical data from before they started using GoalGrid

  // Validate count
  const dailyTarget = goal.dailyTarget ?? 1
  if (count < 0 || count > dailyTarget) {
    return { ok: false, error: `Count must be between 0 and ${dailyTarget}.` }
  }

  // Get the week key for the target date
  const weekKey = getWeekKey(targetDate, user.timezone)

  // Create a timestamp at noon on the target date (in user's timezone)
  // Parse the date string and add 12 hours to get noon
  // The date string is already in YYYY-MM-DD format, so we create a Date at noon UTC
  // and that will be stored consistently regardless of server timezone
  const timestamp = new Date(`${date}T12:00:00Z`)

  // Get existing check-ins for this date
  const existingCheckIns = await prisma.checkIn.findMany({
    where: {
      goalId: goal.id,
      userId: session.user.id,
      localDateKey: date,
    },
  })

  const existingCount = existingCheckIns.length

  // Use a transaction to update the check-ins
  await prisma.$transaction(async (tx) => {
    if (count > existingCount) {
      // Need to add more check-ins
      const toAdd = count - existingCount
      const newCheckIns = Array.from({ length: toAdd }).map(() => ({
        goalId: goal.id,
        userId: session.user.id,
        timestamp,
        localDateKey: date,
        weekKey,
        isPartial: false,
      }))
      await tx.checkIn.createMany({ data: newCheckIns })
    } else if (count < existingCount) {
      // Need to remove check-ins
      const toRemove = existingCount - count
      const idsToDelete = existingCheckIns.slice(0, toRemove).map((c) => c.id)
      await tx.checkIn.deleteMany({
        where: { id: { in: idsToDelete } },
      })
    }
    // If count === existingCount, nothing to do
  })

  revalidatePath("/dashboard")
  revalidatePath("/group")
  revalidatePath("/goals")
  revalidatePath(`/goals/${goal.id}`)

  return { ok: true, count }
}

/**
 * Get check-ins for a specific date
 */
export async function getHistoricalCheckInsAction({
  goalId,
  date,
}: {
  goalId: string
  date: string // YYYY-MM-DD format
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      ownerId: session.user.id,
    },
  })
  if (!goal) return { ok: false, error: "Goal not found or not yours." }

  const checkIns = await prisma.checkIn.findMany({
    where: {
      goalId: goal.id,
      userId: session.user.id,
      localDateKey: date,
    },
    orderBy: { timestamp: "asc" },
  })

  return {
    ok: true,
    count: checkIns.length,
    dailyTarget: goal.dailyTarget ?? 1,
    checkIns: checkIns.map((c) => ({
      id: c.id,
      timestamp: c.timestamp.toISOString(),
      isPartial: c.isPartial,
    })),
  }
}

/**
 * Delete a specific historical check-in
 */
export async function deleteHistoricalCheckInAction({
  checkInId,
}: {
  checkInId: string
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const checkIn = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    include: { goal: true },
  })

  if (!checkIn) {
    return { ok: false, error: "Check-in not found." }
  }

  if (checkIn.goal.ownerId !== session.user.id) {
    return { ok: false, error: "Not authorized to delete this check-in." }
  }

  await prisma.checkIn.delete({
    where: { id: checkInId },
  })

  revalidatePath("/dashboard")
  revalidatePath("/group")
  revalidatePath("/goals")
  revalidatePath(`/goals/${checkIn.goalId}`)

  return { ok: true }
}

/**
 * Bulk log historical check-ins for multiple dates at once
 * Efficiently handles date ranges, patterns, and streaks
 */
export async function bulkLogHistoricalAction({
  goalId,
  dates,
  countPerDay,
  mode = "set",
}: {
  goalId: string
  dates: string[] // Array of YYYY-MM-DD strings
  countPerDay: number // Completions per day
  mode?: "set" | "add" // "set" replaces existing, "add" adds to existing
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) return { ok: false, error: "User not found." }

  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      ownerId: session.user.id,
    },
  })
  if (!goal) return { ok: false, error: "Goal not found or not yours." }

  // Validate
  if (dates.length === 0) {
    return { ok: false, error: "No dates provided." }
  }
  if (dates.length > 365) {
    return { ok: false, error: "Maximum 365 days per operation." }
  }

  const dailyTarget = goal.dailyTarget ?? 1
  if (countPerDay < 0 || countPerDay > dailyTarget) {
    return { ok: false, error: `Count must be between 0 and ${dailyTarget}.` }
  }

  // Validate all dates are in the past
  const todayKey = getLocalDateKey(new Date(), user.timezone)
  const invalidDates = dates.filter((d) => d >= todayKey)
  if (invalidDates.length > 0) {
    return { ok: false, error: "All dates must be in the past." }
  }

  // Fetch existing check-ins for all dates in one query
  const existingCheckIns = await prisma.checkIn.findMany({
    where: {
      goalId: goal.id,
      userId: session.user.id,
      localDateKey: { in: dates },
    },
    select: { id: true, localDateKey: true },
  })

  // Group existing check-ins by date
  const existingByDate: Record<string, string[]> = {}
  for (const checkIn of existingCheckIns) {
    if (!existingByDate[checkIn.localDateKey]) {
      existingByDate[checkIn.localDateKey] = []
    }
    existingByDate[checkIn.localDateKey].push(checkIn.id)
  }

  // Calculate changes needed
  const toCreate: { localDateKey: string; weekKey: string; timestamp: Date }[] = []
  const toDelete: string[] = []

  for (const date of dates) {
    const existing = existingByDate[date] ?? []
    const existingCount = existing.length

    let targetCount: number
    if (mode === "set") {
      targetCount = countPerDay
    } else {
      // "add" mode - add to existing, cap at dailyTarget
      targetCount = Math.min(existingCount + countPerDay, dailyTarget)
    }

    if (targetCount > existingCount) {
      // Need to add check-ins
      const toAdd = targetCount - existingCount
      const targetDate = parseISO(date)
      const weekKey = getWeekKey(targetDate, user.timezone)
      const timestamp = new Date(`${date}T12:00:00Z`)
      
      for (let i = 0; i < toAdd; i++) {
        toCreate.push({ localDateKey: date, weekKey, timestamp })
      }
    } else if (targetCount < existingCount) {
      // Need to remove check-ins
      const toRemove = existingCount - targetCount
      toDelete.push(...existing.slice(0, toRemove))
    }
  }

  // Execute changes in a transaction
  await prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.checkIn.deleteMany({
        where: { id: { in: toDelete } },
      })
    }
    if (toCreate.length > 0) {
      await tx.checkIn.createMany({
        data: toCreate.map((c) => ({
          goalId: goal.id,
          userId: session.user.id,
          timestamp: c.timestamp,
          localDateKey: c.localDateKey,
          weekKey: c.weekKey,
          isPartial: false,
        })),
      })
    }
  })

  revalidatePath("/dashboard")
  revalidatePath("/group")
  revalidatePath("/goals")
  revalidatePath(`/goals/${goal.id}`)

  return {
    ok: true,
    daysAffected: dates.length,
    checkInsCreated: toCreate.length,
    checkInsDeleted: toDelete.length,
  }
}
