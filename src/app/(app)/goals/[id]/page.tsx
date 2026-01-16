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
  summarizeDailyCheckIns,
  summarizeWeeklyCheckIns,
} from "@/lib/scoring"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckInButton } from "@/components/check-in-button"
import { TinyHeatmap } from "@/components/tiny-heatmap"
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
  const todayDone = checkIns.some((check) => check.localDateKey === todayKey)

  const dateKeys = summarizeDailyCheckIns(checkIns)
  const currentDailyStreak = computeDailyStreak(dateKeys, todayKey, user.timezone)
  const bestDailyStreak = computeBestDailyStreak(dateKeys, user.timezone)

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{goal.name}</h1>
          <p className="text-sm text-muted-foreground">
            {goal.cadenceType === "DAILY"
              ? "Daily goal"
              : `Weekly target: ${goal.weeklyTarget}x`}
          </p>
        </div>
        <CheckInButton goalId={goal.id} completed={todayDone} />
      </div>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Completion history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <span>{item.localDateKey}</span>
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
              <span className="text-sm text-muted-foreground">Total completions</span>
              <span className="text-lg font-semibold">{checkIns.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">This week</span>
              <span className="text-lg font-semibold">
                {checkInsThisWeek.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current streak</span>
              <Badge variant="secondary">
                {goal.cadenceType === "DAILY"
                  ? `${currentDailyStreak} days`
                  : `${weeklyStreak} weeks`}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Best daily streak</span>
              <span className="text-lg font-semibold">{bestDailyStreak}</span>
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
