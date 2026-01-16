import { computeWeeklyStreak, summarizeWeeklyCheckIns } from "./scoring"
import { getWeekStart } from "./time"

type GoalBadgeInput = {
  cadenceType: "DAILY" | "WEEKLY"
  weeklyTarget: number | null
  checkIns: { weekKey: string }[]
}

export function getBadges({
  totalCheckIns,
  dailyStreaks,
  weeklyGoals,
  timeZone,
  today,
}: {
  totalCheckIns: number
  dailyStreaks: number[]
  weeklyGoals: GoalBadgeInput[]
  timeZone: string
  today: Date
}) {
  const badges: string[] = []
  if (totalCheckIns > 0) badges.push("First Completion")
  if (dailyStreaks.some((streak) => streak >= 7)) badges.push("7-day streak")

  const weekStart = getWeekStart(today, timeZone)
  const hasWeeklyStreak = weeklyGoals.some((goal) => {
    if (!goal.weeklyTarget) return false
    const weeklyCounts = summarizeWeeklyCheckIns(goal.checkIns)
    const streak = computeWeeklyStreak(
      weeklyCounts,
      weekStart,
      timeZone,
      goal.weeklyTarget
    )
    return streak >= 4
  })
  if (hasWeeklyStreak) badges.push("Hit weekly target 4 weeks")

  return badges
}
