/**
 * Unified Points System
 * 
 * This module implements a fair, finish-weighted scoring system with:
 * - Weekly ceiling (1000 points max per user per week)
 * - Effort-weighted goal shares using logarithmic scaling
 * - Blended scoring curve that rewards finishing without being all-or-nothing
 * - Streak multipliers for consistency
 * - Idempotent ledger-based awards
 * 
 * ACTIVE GOALS POLICY:
 * A goal is "active for the week" if:
 * - goal.active === true AND
 * - (goal was created before end of week OR has at least one check-in this week)
 * This prevents new goals from diluting existing goals mid-week.
 */

// === CONSTANTS ===
export const WEEKLY_POINTS_CEILING = 1000  // Max points per user per week
export const ALPHA = 0.7                    // Blend factor for scoring curve
export const GAMMA = 1.8                    // Exponent for finish-weighted curve
export const MAX_DAILY_TARGET = 10          // Cap for weight calculation
export const STREAK_BONUS_PER_WEEK = 0.02   // 2% bonus per week of streak
export const MAX_STREAK_BONUS = 0.10        // Cap streak bonus at 10%

// === TYPES ===
export interface GoalForPoints {
  id: string
  cadenceType: "DAILY" | "WEEKLY"
  dailyTarget: number
  weeklyTarget: number | null
  active: boolean
  createdAt: Date
}

// === CORE FUNCTIONS ===

/**
 * Calculate expected units per week for a goal.
 * - Daily single: 7
 * - Daily multi-target: 7 * T (capped at MAX_DAILY_TARGET)
 * - Weekly: K (weeklyTarget)
 */
export function expectedUnitsPerWeek(goal: GoalForPoints): number {
  if (goal.cadenceType === "WEEKLY") {
    return goal.weeklyTarget ?? 1
  }
  // Daily: 7 * dailyTarget (clamped to avoid extreme weights)
  const T = Math.min(goal.dailyTarget ?? 1, MAX_DAILY_TARGET)
  return 7 * T
}

/**
 * Calculate the weight of a goal using mild effort weighting.
 * weight = ln(1 + expectedUnitsPerWeek)
 */
export function goalWeight(goal: GoalForPoints): number {
  return Math.log(1 + expectedUnitsPerWeek(goal))
}

/**
 * Calculate this goal's share of the weekly ceiling.
 * share = WEEKLY_POINTS_CEILING * (weight / totalWeight)
 */
export function goalShare(
  goal: GoalForPoints,
  allActiveGoals: GoalForPoints[]
): number {
  const totalWeight = allActiveGoals.reduce((sum, g) => sum + goalWeight(g), 0)
  if (totalWeight === 0) return 0
  return WEEKLY_POINTS_CEILING * (goalWeight(goal) / totalWeight)
}

/**
 * Compute weekly progress P for a daily goal.
 * P = average of day completions (each day in [0,1])
 * 
 * @param checkInsByDate Map of date -> check-in count for this goal this week
 * @param dailyTarget How many completions needed per day
 * @param weekDates Array of 7 date strings (YYYY-MM-DD) for the week
 */
export function computeDailyGoalProgress(
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

/**
 * Compute weekly progress P for a weekly goal.
 * P = clamp(checkInsThisWeek / weeklyTarget, 0, 1)
 */
export function computeWeeklyGoalProgress(
  checkInsThisWeek: number,
  weeklyTarget: number
): number {
  return Math.min(checkInsThisWeek / weeklyTarget, 1)
}

/**
 * Blended scoring curve: (1 - alpha) * P + alpha * P^gamma
 * 
 * This creates finish-weighted scoring that:
 * - Gives some points early (not all-or-nothing)
 * - Rewards completing goals more than getting halfway
 */
export function score(P: number): number {
  return (1 - ALPHA) * P + ALPHA * Math.pow(P, GAMMA)
}

/**
 * Calculate the marginal gain in score from progress change.
 */
export function deltaScore(P_before: number, P_after: number): number {
  return score(P_after) - score(P_before)
}

/**
 * Calculate streak multiplier.
 * 
 * @param streakDays Current streak in days
 * @returns Multiplier to apply to base points (1.0 - 1.10)
 */
export function streakMultiplier(streakDays: number): number {
  // 2% bonus per full week of streak, capped at 10%
  const bonus = Math.min(MAX_STREAK_BONUS, STREAK_BONUS_PER_WEEK * Math.floor(streakDays / 7))
  return 1 + bonus
}

/**
 * Determine if a goal is "active for the week".
 * 
 * POLICY: A goal is active for the week if:
 * - goal.active === true AND
 * - (goal was created before end of week OR has at least one check-in this week)
 */
export function isGoalActiveForWeek(
  goal: GoalForPoints,
  weekEndDate: Date,
  hasCheckInThisWeek: boolean
): boolean {
  // If there are check-ins for this goal this week, include it
  // This allows historical check-ins (logged for dates before goal was created) to earn points
  if (hasCheckInThisWeek) return true
  
  // Otherwise, only include if goal is currently active and existed during this week
  if (!goal.active) return false
  return goal.createdAt <= weekEndDate
}

/**
 * Calculate points to award for a check-in.
 * Returns milli-points (multiply display value by 1000 for storage).
 * 
 * @param goal The goal being checked in
 * @param P_before Weekly progress before this check-in
 * @param P_after Weekly progress after this check-in
 * @param activeGoals All goals active for the week (for share calculation)
 * @param streakDays Current streak (for multiplier)
 * @param pointsAlreadyEarnedMilli Points already earned this week (for ceiling)
 */
export function calculatePointsToAward(
  goal: GoalForPoints,
  P_before: number,
  P_after: number,
  activeGoals: GoalForPoints[],
  streakDays: number,
  pointsAlreadyEarnedMilli: number
): { pointsMilli: number; streakBonusApplied: boolean } {
  // 1. Calculate this goal's share of the ceiling
  const share = goalShare(goal, activeGoals)
  
  // 2. Calculate base points from progress delta
  const basePoints = share * deltaScore(P_before, P_after)
  
  // 3. Apply streak multiplier
  const mult = streakMultiplier(streakDays)
  const streakBonusApplied = mult > 1
  const pointsToAward = basePoints * mult
  
  // 4. Clamp to remaining weekly ceiling
  const remainingMilli = WEEKLY_POINTS_CEILING * 1000 - pointsAlreadyEarnedMilli
  const pointsMilli = Math.max(0, Math.min(Math.round(pointsToAward * 1000), remainingMilli))
  
  return { pointsMilli, streakBonusApplied }
}

/**
 * Convert milli-points to display points (whole number).
 */
export function milliToDisplay(milli: number): number {
  return Math.floor(milli / 1000)
}

/**
 * Get the 7 date keys for a week given the week start date.
 */
export function getWeekDates(weekStartDate: Date): string[] {
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() + i)
    dates.push(d.toISOString().split("T")[0])
  }
  return dates
}
