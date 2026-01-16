import { subDays, startOfWeek, endOfWeek, format } from "date-fns"
import { getWeekKey } from "./time"

type MemberGoalData = {
  memberId: string
  memberName: string
  goals: {
    goalId: string
    goalName: string
    cadenceType: "DAILY" | "WEEKLY"
    weeklyTarget: number | null
    completionsThisWeek: number
    completionsLastWeek: number
    consistency: number // 0-100
  }[]
  totalCompletionsThisWeek: number
  totalCompletionsLastWeek: number
  weekOverWeekChange: number // percentage change
}

type WeeklySummary = {
  weekLabel: string
  weekStart: Date
  weekEnd: Date
  topPerformer: { name: string; completions: number } | null
  mostImproved: { name: string; changePercent: number } | null
  groupTotal: number
  groupAverage: number
  memberSummaries: MemberGoalData[]
}

export function computeWeeklySummary(
  members: {
    id: string
    name: string
    goals: {
      id: string
      name: string
      cadenceType: "DAILY" | "WEEKLY"
      weeklyTarget: number | null
      checkIns: { weekKey: string; localDateKey: string }[]
    }[]
  }[],
  timeZone: string
): WeeklySummary {
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const currentWeekKey = getWeekKey(now, timeZone)
  const lastWeekKey = getWeekKey(subDays(weekStart, 1), timeZone)

  const memberSummaries: MemberGoalData[] = members.map((member) => {
    const goals = member.goals.map((goal) => {
      const thisWeekCheckIns = goal.checkIns.filter(
        (c) => c.weekKey === currentWeekKey
      ).length
      const lastWeekCheckIns = goal.checkIns.filter(
        (c) => c.weekKey === lastWeekKey
      ).length

      // Calculate consistency (last 30 days)
      const thirtyDaysAgo = format(subDays(now, 30), "yyyy-MM-dd")
      const recentCheckIns = goal.checkIns.filter(
        (c) => c.localDateKey >= thirtyDaysAgo
      )
      const consistency = Math.round((recentCheckIns.length / 30) * 100)

      return {
        goalId: goal.id,
        goalName: goal.name,
        cadenceType: goal.cadenceType,
        weeklyTarget: goal.weeklyTarget,
        completionsThisWeek: thisWeekCheckIns,
        completionsLastWeek: lastWeekCheckIns,
        consistency,
      }
    })

    const totalThisWeek = goals.reduce((sum, g) => sum + g.completionsThisWeek, 0)
    const totalLastWeek = goals.reduce((sum, g) => sum + g.completionsLastWeek, 0)
    const change =
      totalLastWeek > 0
        ? Math.round(((totalThisWeek - totalLastWeek) / totalLastWeek) * 100)
        : totalThisWeek > 0
        ? 100
        : 0

    return {
      memberId: member.id,
      memberName: member.name,
      goals,
      totalCompletionsThisWeek: totalThisWeek,
      totalCompletionsLastWeek: totalLastWeek,
      weekOverWeekChange: change,
    }
  })

  // Find top performer
  const sortedByCompletions = [...memberSummaries].sort(
    (a, b) => b.totalCompletionsThisWeek - a.totalCompletionsThisWeek
  )
  const topPerformer =
    sortedByCompletions.length > 0 && sortedByCompletions[0].totalCompletionsThisWeek > 0
      ? {
          name: sortedByCompletions[0].memberName,
          completions: sortedByCompletions[0].totalCompletionsThisWeek,
        }
      : null

  // Find most improved (positive change from last week)
  const sortedByImprovement = [...memberSummaries]
    .filter((m) => m.weekOverWeekChange > 0)
    .sort((a, b) => b.weekOverWeekChange - a.weekOverWeekChange)
  const mostImproved =
    sortedByImprovement.length > 0
      ? {
          name: sortedByImprovement[0].memberName,
          changePercent: sortedByImprovement[0].weekOverWeekChange,
        }
      : null

  const groupTotal = memberSummaries.reduce(
    (sum, m) => sum + m.totalCompletionsThisWeek,
    0
  )
  const groupAverage =
    memberSummaries.length > 0
      ? Math.round(groupTotal / memberSummaries.length)
      : 0

  return {
    weekLabel: `Week of ${format(weekStart, "MMM d")}`,
    weekStart,
    weekEnd,
    topPerformer,
    mostImproved,
    groupTotal,
    groupAverage,
    memberSummaries,
  }
}
