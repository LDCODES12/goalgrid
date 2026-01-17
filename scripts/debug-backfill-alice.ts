import { PrismaClient } from "@prisma/client"
import { addDays } from "date-fns"

const prisma = new PrismaClient()

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
  if (goal.cadenceType === "WEEKLY") return goal.weeklyTarget ?? 1
  return 7 * Math.min(goal.dailyTarget ?? 1, MAX_DAILY_TARGET)
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

async function main() {
  const user = await prisma.user.findFirst({ where: { name: "Alice Nguyen" } })
  if (!user) return console.log("User not found")

  console.log("Debugging Alice's backfill...")
  console.log("User ID:", user.id)
  console.log()

  const allCheckIns = await prisma.checkIn.findMany({
    where: { userId: user.id },
    orderBy: { timestamp: "asc" },
    include: { goal: true },
  })

  const allGoals = await prisma.goal.findMany({
    where: { ownerId: user.id },
  })

  console.log("Goals:", allGoals.map(g => ({ id: g.id, name: g.name, active: g.active, createdAt: g.createdAt })))
  console.log()

  // Group by week
  const checkInsByWeek = new Map<string, typeof allCheckIns>()
  for (const ci of allCheckIns) {
    if (!checkInsByWeek.has(ci.weekKey)) checkInsByWeek.set(ci.weekKey, [])
    checkInsByWeek.get(ci.weekKey)!.push(ci)
  }

  const sortedWeeks = Array.from(checkInsByWeek.keys()).sort()
  console.log("Weeks with check-ins:", sortedWeeks)
  console.log()

  for (const weekKey of sortedWeeks) {
    const weekCheckIns = checkInsByWeek.get(weekKey)!
    console.log(`\n=== Processing ${weekKey} (${weekCheckIns.length} check-ins) ===`)

    // Parse weekKey
    const [yearStr, weekNumStr] = weekKey.split("-W")
    const year = parseInt(yearStr)
    const weekNum = parseInt(weekNumStr)
    
    // Calculate week start using ISO week rules
    const jan4 = new Date(year, 0, 4)
    const jan4Day = jan4.getDay() || 7
    const week1Monday = new Date(jan4)
    week1Monday.setDate(jan4.getDate() - (jan4Day - 1))
    const weekStart = addDays(week1Monday, (weekNum - 1) * 7)
    const weekEnd = addDays(weekStart, 6)

    console.log(`Week: ${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`)

    const weekDates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i)
      weekDates.push(d.toISOString().split("T")[0])
    }

    // Count check-ins per goal
    const goalCheckInCounts = new Map<string, number>()
    for (const ci of weekCheckIns) {
      goalCheckInCounts.set(ci.goalId, (goalCheckInCounts.get(ci.goalId) ?? 0) + 1)
    }
    console.log("Goal check-in counts:", Object.fromEntries(goalCheckInCounts))

    // Filter active goals
    console.log("\nGoal activity check:")
    for (const g of allGoals) {
      const hasCI = (goalCheckInCounts.get(g.id) ?? 0) > 0
      const createdBefore = g.createdAt <= weekEnd
      console.log(`  ${g.name}:`)
      console.log(`    active: ${g.active}`)
      console.log(`    createdAt: ${g.createdAt}`)
      console.log(`    weekEnd: ${weekEnd}`)
      console.log(`    createdBefore: ${createdBefore}`)
      console.log(`    hasCheckInThisWeek: ${hasCI}`)
      console.log(`    isActive: ${isGoalActiveForWeek(g as GoalForPoints, weekEnd, hasCI)}`)
    }

    const activeGoalsForWeek: GoalForPoints[] = allGoals.filter((g) =>
      isGoalActiveForWeek(g as GoalForPoints, weekEnd, (goalCheckInCounts.get(g.id) ?? 0) > 0)
    ) as GoalForPoints[]

    console.log(`\nActive goals for week: ${activeGoalsForWeek.length}`)

    if (activeGoalsForWeek.length === 0) {
      console.log("No active goals - skipping week")
      continue
    }

    // Process check-ins
    const goalProgress = new Map<string, { byDate: Map<string, number>; total: number }>()
    for (const goal of activeGoalsForWeek) {
      goalProgress.set(goal.id, { byDate: new Map(), total: 0 })
    }

    for (const checkIn of weekCheckIns) {
      const goal = allGoals.find((g) => g.id === checkIn.goalId)
      if (!goal) {
        console.log(`\nCheck-in ${checkIn.id}: Goal not found`)
        continue
      }

      const goalForPoints: GoalForPoints = goal as GoalForPoints
      const progress = goalProgress.get(goal.id) ?? { byDate: new Map(), total: 0 }

      const P_before = computeDailyGoalProgress(progress.byDate, goal.dailyTarget, weekDates)

      const dateCount = progress.byDate.get(checkIn.localDateKey) ?? 0
      progress.byDate.set(checkIn.localDateKey, dateCount + 1)
      progress.total += 1
      goalProgress.set(goal.id, progress)

      const P_after = computeDailyGoalProgress(progress.byDate, goal.dailyTarget, weekDates)

      const share = goalShare(goalForPoints, activeGoalsForWeek)
      const delta = deltaScore(P_before, P_after)
      const basePointsMilli = Math.round(share * delta * 1000)

      console.log(`\nCheck-in on ${checkIn.localDateKey}:`)
      console.log(`  P_before: ${P_before.toFixed(4)}`)
      console.log(`  P_after: ${P_after.toFixed(4)}`)
      console.log(`  share: ${share.toFixed(2)}`)
      console.log(`  deltaScore: ${delta.toFixed(6)}`)
      console.log(`  basePointsMilli: ${basePointsMilli}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
