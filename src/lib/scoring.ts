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

export function computeDailyStreak(
  checkInDateKeys: string[],
  todayKey: string,
  timeZone: string = "UTC"
) {
  const set = new Set(checkInDateKeys)
  let streak = 0
  let cursor = todayKey
  while (set.has(cursor)) {
    streak += 1
    const cursorDate = parseISO(cursor)
    cursor = getLocalDateKey(subDays(cursorDate, 1), timeZone)
  }
  return streak
}

export function computeBestDailyStreak(
  checkInDateKeys: string[],
  timeZone: string = "UTC"
) {
  if (!checkInDateKeys.length) return 0
  const sorted = [...new Set(checkInDateKeys)].sort()
  let best = 1
  let current = 1
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = parseISO(sorted[i - 1])
    const expected = getLocalDateKey(addDays(prev, 1), timeZone)
    if (sorted[i] === expected) {
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
    if (count >= weeklyTarget) {
      streak += 1
      cursor = addDays(cursor, -7)
    } else {
      break
    }
  }
  return streak
}

export function computeWeeklyPoints({
  goal,
  checkInsThisWeek,
  currentStreak,
  timeZone,
  today,
}: {
  goal: GoalConfig
  checkInsThisWeek: { localDateKey: string }[]
  currentStreak: number
  timeZone: string
  today: Date
}) {
  const pointsPer = goal.pointsPerCheckIn
  const weekKey = getWeekKey(today, timeZone)
  const weekEnd = getWeekEnd(today, timeZone)
  const weekEndKey = getLocalDateKey(weekEnd, timeZone)

  if (goal.cadenceType === "WEEKLY" && goal.weeklyTarget) {
    const totalCheckIns = checkInsThisWeek.length
    const capped = Math.min(totalCheckIns, goal.weeklyTarget)
    let bonus = 0

    if (totalCheckIns >= goal.weeklyTarget) {
      const sorted = [...checkInsThisWeek].sort((a, b) =>
        a.localDateKey.localeCompare(b.localDateKey)
      )
      let completedOn = sorted[sorted.length - 1]?.localDateKey
      let count = 0
      for (const item of sorted) {
        count += 1
        if (count >= goal.weeklyTarget) {
          completedOn = item.localDateKey
          break
        }
      }
      if (completedOn && completedOn < weekEndKey) {
        bonus += goal.weeklyTargetBonus
      }
    }

    return capped * pointsPer + bonus
  }

  const total = checkInsThisWeek.length
  let bonus = 0
  for (const milestone of streakMilestones) {
    if (currentStreak >= milestone) {
      const milestoneDate = subDays(today, currentStreak - milestone)
      if (getWeekKey(milestoneDate, timeZone) === weekKey) {
        bonus += goal.streakBonus
      }
    }
  }

  return total * pointsPer + bonus
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
 * Returns a value 0-100 representing % of days with check-ins
 */
export function computeConsistencyPercentage(
  checkInDateKeys: string[],
  todayKey: string,
  timeZone: string,
  days: number = 30
): number {
  const set = new Set(checkInDateKeys)
  let completed = 0
  let cursor = todayKey

  for (let i = 0; i < days; i++) {
    if (set.has(cursor)) {
      completed++
    }
    const cursorDate = parseISO(cursor)
    cursor = getLocalDateKey(subDays(cursorDate, 1), timeZone)
  }

  return Math.round((completed / days) * 100)
}

/**
 * Compute streak with grace period - allows 1 miss without breaking streak
 * "Never miss twice" rule: one gap is forgiven, two consecutive gaps breaks streak
 */
export function computeGracefulStreak(
  checkInDateKeys: string[],
  todayKey: string,
  timeZone: string,
  allowedFreezes: number = 1
): { currentStreak: number; freezesUsed: number; isAtRisk: boolean } {
  const set = new Set(checkInDateKeys)
  let streak = 0
  let freezesUsed = 0
  let consecutiveMisses = 0
  let cursor = todayKey
  let isAtRisk = false

  // Check if today is done
  const todayDone = set.has(todayKey)
  if (!todayDone) {
    // Check yesterday - if yesterday was done, streak is at risk but not broken
    const yesterdayKey = getLocalDateKey(subDays(parseISO(todayKey), 1), timeZone)
    if (set.has(yesterdayKey)) {
      isAtRisk = true
    }
  }

  while (true) {
    if (set.has(cursor)) {
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
 * Get soft failure message based on consistency and recent activity
 */
export function getSoftFailureMessage(
  consistency: number,
  lastNDaysCompleted: number,
  lastNDays: number = 30
): string | null {
  if (consistency >= 80) {
    return null // No failure message needed - doing great!
  }
  
  if (consistency >= 60) {
    return `You've completed ${lastNDaysCompleted} of the last ${lastNDays} days. Keep it up!`
  }
  
  if (consistency >= 40) {
    return `${lastNDaysCompleted} of ${lastNDays} days completed. Every day is a fresh start.`
  }
  
  if (lastNDaysCompleted > 0) {
    return `You showed up ${lastNDaysCompleted} times recently. That counts!`
  }
  
  return "Ready to get back on track? Start with just today."
}

/**
 * Count completions in the last N days
 */
export function countRecentCompletions(
  checkInDateKeys: string[],
  todayKey: string,
  timeZone: string,
  days: number = 30
): number {
  const set = new Set(checkInDateKeys)
  let completed = 0
  let cursor = todayKey

  for (let i = 0; i < days; i++) {
    if (set.has(cursor)) {
      completed++
    }
    const cursorDate = parseISO(cursor)
    cursor = getLocalDateKey(subDays(cursorDate, 1), timeZone)
  }

  return completed
}
