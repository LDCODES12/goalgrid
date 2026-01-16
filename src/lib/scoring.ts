import { parseISO, subDays, addDays, differenceInDays } from "date-fns"
import { getLocalDateKey, getWeekEnd, getWeekKey, getWeekStart } from "./time"

type GoalConfig = {
  cadenceType: "DAILY" | "WEEKLY"
  pointsPerCheckIn: number
  weeklyTarget: number | null
  weeklyTargetBonus: number
  streakBonus: number
}

const streakMilestones = [7, 14, 30]

/**
 * Helper: Count check-ins per date
 */
function countByDate(checkInDateKeys: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const key of checkInDateKeys) {
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * Helper: Check if a day is "complete" based on target
 */
function isDayComplete(counts: Map<string, number>, dateKey: string, dailyTarget: number): boolean {
  return (counts.get(dateKey) ?? 0) >= dailyTarget
}

/**
 * Compute current daily streak (consecutive days of completion starting from today)
 * For multi-target goals, only counts days where target was fully met
 */
export function computeDailyStreak(
  checkInDateKeys: string[],
  todayKey: string,
  timeZone: string = "UTC",
  dailyTarget: number = 1
) {
  const counts = countByDate(checkInDateKeys)
  let streak = 0
  let cursor = todayKey
  
  while (isDayComplete(counts, cursor, dailyTarget)) {
    streak += 1
    const cursorDate = parseISO(cursor)
    cursor = getLocalDateKey(subDays(cursorDate, 1), timeZone)
  }
  return streak
}

/**
 * Compute best daily streak ever achieved
 * For multi-target goals, only counts days where target was fully met
 */
export function computeBestDailyStreak(
  checkInDateKeys: string[],
  timeZone: string = "UTC",
  dailyTarget: number = 1
) {
  if (!checkInDateKeys.length) return 0
  
  const counts = countByDate(checkInDateKeys)
  
  // Get unique dates where target was met, sorted
  const completeDays = [...counts.entries()]
    .filter(([_, count]) => count >= dailyTarget)
    .map(([date]) => date)
    .sort()
  
  if (completeDays.length === 0) return 0
  
  let best = 1
  let current = 1
  
  for (let i = 1; i < completeDays.length; i += 1) {
    const prev = parseISO(completeDays[i - 1])
    const expected = getLocalDateKey(addDays(prev, 1), timeZone)
    if (completeDays[i] === expected) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 1
    }
  }
  return best
}

export function computeWeeklyStreak(
  weekCounts: Record<string, number>,
  currentWeekStart: Date,
  timeZone: string,
  weeklyTarget: number
) {
  let streak = 0
  let cursor = currentWeekStart
  while (true) {
    const key = getWeekKey(cursor, timeZone)
    const count = weekCounts[key] ?? 0
    if (count < weeklyTarget) break
    streak += 1
    cursor = subDays(cursor, 7)
  }
  return streak
}

export function computeWeeklyPoints({
  goal,
  checkInsThisWeek,
  dailyStreak,
}: {
  goal: GoalConfig
  checkInsThisWeek: number
  dailyStreak: number
}) {
  let points = checkInsThisWeek * goal.pointsPerCheckIn

  if (
    goal.cadenceType === "WEEKLY" &&
    goal.weeklyTarget != null &&
    checkInsThisWeek >= goal.weeklyTarget
  ) {
    points += goal.weeklyTargetBonus
  }

  if (streakMilestones.includes(dailyStreak)) {
    points += goal.streakBonus
  }

  return points
}

export function summarizeWeeklyCheckIns(
  checkIns: { weekKey: string }[]
): Record<string, number> {
  return checkIns.reduce((acc, item) => {
    acc[item.weekKey] = (acc[item.weekKey] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export function summarizeDailyCheckIns(
  checkIns: { localDateKey: string }[]
): string[] {
  return checkIns.map((item) => item.localDateKey)
}

/**
 * Compute consistency percentage over the last N days
 * Returns a value 0-100 representing % of days where dailyTarget was met
 * 
 * If goalCreatedAt is provided, only counts days since goal creation
 */
export function computeConsistencyPercentage(
  checkInDateKeys: string[],
  todayKey: string,
  timeZone: string,
  days: number = 30,
  goalCreatedAt?: Date,
  dailyTarget: number = 1
): number {
  const counts = countByDate(checkInDateKeys)
  
  let completed = 0
  let totalDays = 0
  let cursor = todayKey
  
  // Calculate the earliest date key to consider (goal creation date)
  const createdDateKey = goalCreatedAt 
    ? getLocalDateKey(goalCreatedAt, timeZone) 
    : null

  for (let i = 0; i < days; i++) {
    // Stop if we've gone past the goal creation date
    if (createdDateKey && cursor < createdDateKey) {
      break
    }
    
    totalDays++
    
    if (isDayComplete(counts, cursor, dailyTarget)) {
      completed++
    }
    
    const cursorDate = parseISO(cursor)
    cursor = getLocalDateKey(subDays(cursorDate, 1), timeZone)
  }

  if (totalDays === 0) return 100 // Goal was just created
  return Math.round((completed / totalDays) * 100)
}

/**
 * Compute streak with grace period - allows N misses without breaking streak
 * "Never miss twice" rule: consecutive misses beyond allowedFreezes breaks streak
 * 
 * For multi-target goals, a day is only "complete" if the full target is met
 */
export function computeGracefulStreak(
  checkInDateKeys: string[],
  todayKey: string,
  timeZone: string,
  allowedFreezes: number = 1,
  dailyTarget: number = 1
): { currentStreak: number; freezesUsed: number; isAtRisk: boolean } {
  const counts = countByDate(checkInDateKeys)
  let streak = 0
  let freezesUsed = 0
  let consecutiveMisses = 0
  let cursor = todayKey
  let isAtRisk = false

  // Check if today is done (target met)
  const todayDone = isDayComplete(counts, todayKey, dailyTarget)
  if (!todayDone) {
    // Check yesterday - if yesterday was done, streak is at risk but not broken
    const yesterdayKey = getLocalDateKey(subDays(parseISO(todayKey), 1), timeZone)
    if (isDayComplete(counts, yesterdayKey, dailyTarget)) {
      isAtRisk = true
    }
  }

  while (true) {
    if (isDayComplete(counts, cursor, dailyTarget)) {
      streak++
      consecutiveMisses = 0
    } else {
      consecutiveMisses++
      if (consecutiveMisses > allowedFreezes) {
        // Too many consecutive misses - streak ends here
        break
      }
      // Use a freeze
      freezesUsed++
    }
    const cursorDate = parseISO(cursor)
    cursor = getLocalDateKey(subDays(cursorDate, 1), timeZone)
    
    // Safety limit to prevent infinite loops
    if (streak + freezesUsed > 365) break
  }

  return { currentStreak: streak, freezesUsed, isAtRisk }
}

/**
 * Get a soft failure message based on recent performance
 */
export function getSoftFailureMessage(
  consistency: number,
  lastNDaysCompleted: number,
  lastNDays: number = 30
): string | null {
  if (consistency >= 80) {
    return `Great job! You've hit ${consistency}% consistency over the last ${lastNDays} days.`
  }
  if (consistency >= 50) {
    return `You've completed ${lastNDaysCompleted} of the last ${lastNDays} days. Keep building momentum!`
  }
  if (lastNDaysCompleted > 0) {
    return `You've completed ${lastNDaysCompleted} days recently. Every check-in counts!`
  }
  return null
}

/**
 * Count completions in last N days
 */
export function countRecentCompletions(
  checkInDateKeys: string[],
  todayKey: string,
  timeZone: string,
  days: number = 30,
  dailyTarget: number = 1
): number {
  const counts = countByDate(checkInDateKeys)
  let completed = 0
  let cursor = todayKey

  for (let i = 0; i < days; i++) {
    if (isDayComplete(counts, cursor, dailyTarget)) {
      completed++
    }
    const cursorDate = parseISO(cursor)
    cursor = getLocalDateKey(subDays(cursorDate, 1), timeZone)
  }

  return completed
}
