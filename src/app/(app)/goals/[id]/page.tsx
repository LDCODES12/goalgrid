import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { parseISO, subDays } from "date-fns"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getLocalDateKey, getWeekKey, getWeekStart } from "@/lib/time"
import {
  computeBestDailyStreak,
  computeDailyStreak,
  computeWeeklyStreak,
  computeConsistencyPercentage,
  computeGracefulStreak,
  countRecentCompletions,
  getSoftFailureMessage,
  summarizeDailyCheckIns,
  summarizeWeeklyCheckIns,
} from "@/lib/scoring"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckInButton } from "@/components/check-in-button"
import { DeleteGoalButton } from "@/components/delete-goal-button"
import { TinyHeatmap } from "@/components/tiny-heatmap"
import { MonthlyHeatmap } from "@/components/monthly-heatmap"
import { Sparkline } from "@/components/sparkline"

export default async function GoalDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/auth/signin")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) redirect("/auth/signin")

  const goal = await prisma.goal.findFirst({
    where: { id: params.id, ownerId: user.id },
    include: { checkIns: true },
  })
  if (!goal) redirect("/goals")

  const todayKey = getLocalDateKey(new Date(), user.timezone)
  const weekKey = getWeekKey(new Date(), user.timezone)
  const weekStart = getWeekStart(new Date(), user.timezone)

  const checkIns = goal.checkIns.filter((check) => check.userId === user.id)
  const checkInsThisWeek = checkIns.filter((check) => check.weekKey === weekKey)
  const todayCheckIns = checkIns.filter((check) => check.localDateKey === todayKey)
  const dailyTarget = goal.dailyTarget ?? 1
  const todayCount = todayCheckIns.length
  const todayDone = todayCount >= dailyTarget
  const todayPartial = todayCheckIns.length > 0 && todayCheckIns[0]?.isPartial && dailyTarget === 1

  const dateKeys = summarizeDailyCheckIns(checkIns)
  const currentDailyStreak = computeDailyStreak(dateKeys, todayKey, user.timezone, dailyTarget)
  const bestDailyStreak = computeBestDailyStreak(dateKeys, user.timezone, dailyTarget)
  const consistency = computeConsistencyPercentage(
    dateKeys, todayKey, user.timezone, 30, goal.createdAt, dailyTarget
  )
  const gracefulStreak = computeGracefulStreak(dateKeys, todayKey, user.timezone, goal.streakFreezes, dailyTarget)
  const recentCompletions = countRecentCompletions(dateKeys, todayKey, user.timezone, 30, dailyTarget)
  const softMessage = !todayDone ? getSoftFailureMessage(consistency, recentCompletions, 30) : null

  const weeklyCounts = summarizeWeeklyCheckIns(checkIns)
  const weeklyStreak =
    goal.cadenceType === "WEEKLY" && goal.weeklyTarget
      ? computeWeeklyStreak(weeklyCounts, weekStart, user.timezone, goal.weeklyTarget)
      : 0

  const checkInDates = dateKeys.map((key) => parseISO(key))
  const recentCheckIns = [...checkIns]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 8)

  const last7Keys = Array.from({ length: 7 }).map((_, index) =>
    getLocalDateKey(subDays(new Date(), 6 - index), user.timezone)
  )
  const last7Counts = last7Keys.map(
    (key) => checkIns.filter((check) => check.localDateKey === key).length
  )
  const last21Keys = Array.from({ length: 21 }).map((_, index) =>
    getLocalDateKey(subDays(new Date(), 20 - index), user.timezone)
  )
  const sparkValues = last21Keys.map(
    (key) => checkIns.filter((check) => check.localDateKey === key).length
  )

  // Monthly heatmap data (last 84 days)
  const heatmapData = Array.from({ length: 84 }).map((_, index) => {
    const date = subDays(new Date(), 83 - index)
    const dateKey = getLocalDateKey(date, user.timezone)
    const dayCheckIns = checkIns.filter((check) => check.localDateKey === dateKey)
    return {
      date: dateKey,
      count: dayCheckIns.length,
      isPartial: dayCheckIns.some((check) => check.isPartial) && !dayCheckIns.some((check) => !check.isPartial),
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{goal.name}</h1>
            <Badge variant="secondary">{consistency}% consistency</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {goal.cadenceType === "DAILY"
              ? "Daily goal"
              : `Weekly target: ${goal.weeklyTarget}x`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CheckInButton 
            goalId={goal.id} 
            completed={todayDone} 
            label="Complete" 
          />
          <DeleteGoalButton goalId={goal.id} goalName={goal.name} />
        </div>
      </div>

      {softMessage && (
        <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {softMessage}
        </div>
      )}

      {gracefulStreak.isAtRisk && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          Your streak is at risk! Complete today to keep it alive.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Completion history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-2">
                Last 12 weeks
              </div>
              <MonthlyHeatmap data={heatmapData} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Last 7 days
                </div>
                <div className="mt-2">
                  <TinyHeatmap counts={last7Counts} />
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Streak activity
                </div>
                <div className="mt-2">
                  <Sparkline values={sparkValues} />
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">
              Recent completions
            </div>
            <div className="space-y-2 text-sm">
              {recentCheckIns.length === 0 ? (
                <div className="text-muted-foreground">
                  No completions yet. Tap “Complete” to start.
                </div>
              ) : (
                recentCheckIns.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border bg-background px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          item.isPartial ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                      />
                      <span>{item.localDateKey}</span>
                      {item.isPartial && (
                        <span className="text-xs text-amber-500">partial</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Consistency (30d)</span>
              <span className="text-lg font-semibold">{consistency}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">This week</span>
              <span className="text-lg font-semibold">
                {checkInsThisWeek.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current streak</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {goal.cadenceType === "DAILY"
                    ? `${gracefulStreak.currentStreak} days`
                    : `${weeklyStreak} weeks`}
                </Badge>
                {gracefulStreak.freezesUsed > 0 && (
                  <span className="text-xs text-amber-500">
                    ({gracefulStreak.freezesUsed} freeze)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Best streak</span>
              <span className="text-lg font-semibold">{bestDailyStreak} days</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total completions</span>
              <span className="text-lg font-semibold">{checkIns.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last 30 days</span>
              <span className="text-lg font-semibold">{recentCompletions}/30</span>
            </div>
            {goal.notes ? (
              <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">
                {goal.notes}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
