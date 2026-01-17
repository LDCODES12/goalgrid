/**
 * One-time script to backfill points for all users.
 * Run this after deploying the points system to credit existing check-ins.
 * 
 * Usage: npx tsx scripts/backfill-all-points.ts
 */

import { PrismaClient } from "@prisma/client"
import { addDays } from "date-fns"

const prisma = new PrismaClient()

// Constants from points.ts
const WEEKLY_POINTS_CEILING = 1000
const ALPHA = 0.7
const GAMMA = 1.8
const MAX_DAILY_TARGET = 10

interface GoalForPoints {
  id: string
  cadenceType: "DAILY" | "WEEKLY"
  dailyTarget: number
  weeklyTarget: number | null
  active: boolean
  createdAt: Date
}

function expectedUnitsPerWeek(goal: GoalForPoints): number {
  if (goal.cadenceType === "WEEKLY") {
    return goal.weeklyTarget ?? 1
  }
  const T = Math.min(goal.dailyTarget ?? 1, MAX_DAILY_TARGET)
  return 7 * T
}

function goalWeight(goal: GoalForPoints): number {
  return Math.log(1 + expectedUnitsPerWeek(goal))
}

function goalShare(goal: GoalForPoints, allActiveGoals: GoalForPoints[]): number {
  const totalWeight = allActiveGoals.reduce((sum, g) => sum + goalWeight(g), 0)
  if (totalWeight === 0) return 0
  return WEEKLY_POINTS_CEILING * (goalWeight(goal) / totalWeight)
}

function computeDailyGoalProgress(
  checkInsByDate: Map<string, number>,
  dailyTarget: number,
  weekDates: string[]
): number {
  let totalDayProgress = 0
  for (const date of weekDates) {
    const count = checkInsByDate.get(date) ?? 0
    totalDayProgress += Math.min(count / dailyTarget, 1)
  }
  return totalDayProgress / 7
}

function computeWeeklyGoalProgress(checkInsThisWeek: number, weeklyTarget: number): number {
  return Math.min(checkInsThisWeek / weeklyTarget, 1)
}

function score(P: number): number {
  return (1 - ALPHA) * P + ALPHA * Math.pow(P, GAMMA)
}

function deltaScore(P_before: number, P_after: number): number {
  return score(P_after) - score(P_before)
}

function isGoalActiveForWeek(goal: GoalForPoints, weekEndDate: Date, hasCheckInThisWeek: boolean): boolean {
  if (!goal.active) return false
  const createdBeforeWeekEnd = goal.createdAt <= weekEndDate
  return createdBeforeWeekEnd || hasCheckInThisWeek
}

function getWeekKey(date: Date, timezone: string): string {
  // Simple ISO week calculation
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`
}

async function backfillUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { error: "User not found" }

  const allCheckIns = await prisma.checkIn.findMany({
    where: { userId },
    orderBy: { timestamp: "asc" },
    include: { goal: true },
  })

  if (allCheckIns.length === 0) {
    return { checkIns: 0, pointsAwarded: 0 }
  }

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

  const sortedWeeks = Array.from(checkInsByWeek.keys()).sort()
  let totalPointsMilli = 0
  let insertedCount = 0

  for (const weekKey of sortedWeeks) {
    const weekCheckIns = checkInsByWeek.get(weekKey)!
    
    // Parse weekKey
    const [yearStr, weekNumStr] = weekKey.split("-W")
    const year = parseInt(yearStr)
    const weekNum = parseInt(weekNumStr)
    
    // Calculate week start using ISO week rules
    // ISO week 1 contains January 4, weeks start on Monday
    const jan4 = new Date(year, 0, 4)
    const jan4Day = jan4.getDay() || 7 // Monday=1, Sunday=7
    // Monday of week 1 = Jan 4 minus (jan4Day - 1) days
    const week1Monday = new Date(jan4)
    week1Monday.setDate(jan4.getDate() - (jan4Day - 1))
    // Week N starts (weekNum - 1) * 7 days after week 1 Monday
    const weekStart = addDays(week1Monday, (weekNum - 1) * 7)
    const weekEnd = addDays(weekStart, 6)

    const weekDates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i)
      weekDates.push(d.toISOString().split("T")[0])
    }

    // Determine active goals
    const goalCheckInCounts = new Map<string, number>()
    for (const ci of weekCheckIns) {
      goalCheckInCounts.set(ci.goalId, (goalCheckInCounts.get(ci.goalId) ?? 0) + 1)
    }

    const activeGoalsForWeek: GoalForPoints[] = allGoals.filter((g) =>
      isGoalActiveForWeek(g as GoalForPoints, weekEnd, (goalCheckInCounts.get(g.id) ?? 0) > 0)
    ) as GoalForPoints[]

    // Track progress per goal
    const goalProgress = new Map<string, { byDate: Map<string, number>; total: number }>()
    for (const goal of activeGoalsForWeek) {
      goalProgress.set(goal.id, { byDate: new Map(), total: 0 })
    }

    let weekPointsMilli = 0

    for (const checkIn of weekCheckIns) {
      const goal = allGoals.find((g) => g.id === checkIn.goalId)
      if (!goal) continue

      const goalForPoints: GoalForPoints = goal as GoalForPoints
      const progress = goalProgress.get(goal.id) ?? { byDate: new Map(), total: 0 }

      let P_before: number
      if (goal.cadenceType === "DAILY") {
        P_before = computeDailyGoalProgress(progress.byDate, goal.dailyTarget, weekDates)
      } else {
        P_before = computeWeeklyGoalProgress(progress.total, goal.weeklyTarget ?? 1)
      }

      const dateCount = progress.byDate.get(checkIn.localDateKey) ?? 0
      progress.byDate.set(checkIn.localDateKey, dateCount + 1)
      progress.total += 1
      goalProgress.set(goal.id, progress)

      let P_after: number
      if (goal.cadenceType === "DAILY") {
        P_after = computeDailyGoalProgress(progress.byDate, goal.dailyTarget, weekDates)
      } else {
        P_after = computeWeeklyGoalProgress(progress.total, goal.weeklyTarget ?? 1)
      }

      const share = goalShare(goalForPoints, activeGoalsForWeek)
      const basePointsMilli = Math.round(share * deltaScore(P_before, P_after) * 1000)
      const remainingMilli = WEEKLY_POINTS_CEILING * 1000 - weekPointsMilli
      const pointsMilli = Math.max(0, Math.min(basePointsMilli, remainingMilli))

      if (pointsMilli > 0) {
        try {
          await prisma.pointLedger.create({
            data: {
              userId,
              goalId: goal.id,
              weekKey,
              localDate: checkIn.localDateKey,
              pointsMilli,
              reason: "CHECKIN_POINTS",
              sourceId: checkIn.id,
            },
          })
          insertedCount++
          weekPointsMilli += pointsMilli
          totalPointsMilli += pointsMilli
        } catch (e: unknown) {
          if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
            continue // Already exists
          }
          throw e
        }
      }
    }
  }

  // Recalculate totals
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

  return {
    checkIns: allCheckIns.length,
    insertedCount,
    pointsAwarded: Math.floor(totalPointsMilli / 1000),
    totalLifetime: Math.floor((lifetimeTotal._sum.pointsMilli ?? 0) / 1000),
  }
}

async function main() {
  console.log("Backfilling points for all users...")
  console.log("===================================\n")

  const users = await prisma.user.findMany({
    select: { id: true, name: true },
  })

  for (const user of users) {
    console.log(`Processing ${user.name}...`)
    const result = await backfillUser(user.id)
    if ("error" in result) {
      console.log(`  Error: ${result.error}`)
    } else {
      console.log(`  Check-ins: ${result.checkIns}`)
      console.log(`  New ledger entries: ${result.insertedCount}`)
      console.log(`  Lifetime points: ${result.totalLifetime}`)
    }
    console.log()
  }

  console.log("Done!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
