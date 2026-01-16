import { getServerSession } from "next-auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getLocalDateKey, getWeekKey, getWeekStart } from "@/lib/time"
import { formatInTimeZone } from "date-fns-tz"
import { addDays, subDays } from "date-fns"
import {
  computeDailyStreak,
  computeWeeklyPoints,
  computeWeeklyStreak,
  summarizeDailyCheckIns,
  summarizeWeeklyCheckIns,
} from "@/lib/scoring"
import { getBadges } from "@/lib/badges"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckInButton } from "@/components/check-in-button"
import { CompletionRing } from "@/components/completion-ring"
import { FocusModeToggle } from "@/components/focus-mode-toggle"
import { TinyHeatmap } from "@/components/tiny-heatmap"
import { Sparkline } from "@/components/sparkline"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/auth/signin")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) redirect("/auth/signin")

  const membership = await prisma.groupMember.findFirst({
    where: { userId: user.id },
    include: { group: true },
  })

  const goals = await prisma.goal.findMany({
    where: { ownerId: user.id, active: true },
    include: { checkIns: true },
    orderBy: { createdAt: "desc" },
  })

  const todayKey = getLocalDateKey(new Date(), user.timezone)
  const now = new Date()
  const weekKey = getWeekKey(now, user.timezone)
  const weekStart = getWeekStart(now, user.timezone)
  const lastWeekKey = getWeekKey(subDays(now, 7), user.timezone)
  const weekdayNumber = Number(formatInTimeZone(now, user.timezone, "i"))
  const daysElapsed = Math.max(1, Math.min(7, weekdayNumber))

  const todayGoals = goals.map((goal) => {
    const checkIns = goal.checkIns.filter((check) => check.userId === user.id)
    const todayDone = checkIns.some((check) => check.localDateKey === todayKey)
    const checkInsThisWeek = checkIns.filter(
      (check) => check.weekKey === weekKey
    )

    const dailyStreak = computeDailyStreak(
      summarizeDailyCheckIns(checkIns),
      todayKey
    )
    const weeklyCounts = summarizeWeeklyCheckIns(checkIns)
    const weeklyStreak =
      goal.cadenceType === "WEEKLY" && goal.weeklyTarget
        ? computeWeeklyStreak(weeklyCounts, weekStart, user.timezone, goal.weeklyTarget)
        : 0

    return {
      goal,
      todayDone,
      checkInsThisWeek,
      dailyStreak,
      weeklyStreak,
      checkIns,
    }
  })

  const hasMissingToday =
    todayGoals.filter((item) => item.goal.cadenceType === "DAILY")
      .length > 0 &&
    todayGoals.some(
      (item) => item.goal.cadenceType === "DAILY" && !item.todayDone
    )

  const totalCheckIns = todayGoals.reduce(
    (sum, item) => sum + item.checkIns.length,
    0
  )
  const weeklyScore = todayGoals.reduce((sum, item) => {
    return (
      sum +
      computeWeeklyPoints({
        goal: {
          cadenceType: item.goal.cadenceType,
          pointsPerCheckIn: item.goal.pointsPerCheckIn,
          weeklyTarget: item.goal.weeklyTarget,
          weeklyTargetBonus: item.goal.weeklyTargetBonus,
          streakBonus: item.goal.streakBonus,
        },
        checkInsThisWeek: item.checkInsThisWeek,
        currentStreak: item.dailyStreak,
        timeZone: user.timezone,
        today: now,
      })
    )
  }, 0)
  const lastWeekScore = todayGoals.reduce((sum, item) => {
    const lastWeekCheckIns = item.checkIns.filter(
      (check) => check.weekKey === lastWeekKey
    )
    return (
      sum +
      computeWeeklyPoints({
        goal: {
          cadenceType: item.goal.cadenceType,
          pointsPerCheckIn: item.goal.pointsPerCheckIn,
          weeklyTarget: item.goal.weeklyTarget,
          weeklyTargetBonus: item.goal.weeklyTargetBonus,
          streakBonus: item.goal.streakBonus,
        },
        checkInsThisWeek: lastWeekCheckIns,
        currentStreak: item.dailyStreak,
        timeZone: user.timezone,
        today: subDays(now, 7),
      })
    )
  }, 0)

  const maxDailyStreak = Math.max(
    0,
    ...todayGoals
      .filter((item) => item.goal.cadenceType === "DAILY")
      .map((item) => item.dailyStreak)
  )
  const streakProgress = Math.min(
    100,
    Math.round((maxDailyStreak / 7) * 100)
  )
  const pendingGoal = todayGoals.find((item) => !item.todayDone)

  const hourCounts = todayGoals
    .flatMap((item) => item.checkIns)
    .reduce((acc, checkIn) => {
      const hour = formatInTimeZone(checkIn.timestamp, user.timezone, "HH")
      acc[hour] = (acc[hour] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
  const bestTimeLabel = bestHour ? `${bestHour[0]}:00` : "Not enough data"

  const trendDelta = weeklyScore - lastWeekScore
  const trendLabel =
    trendDelta === 0
      ? "Same as last week"
      : trendDelta > 0
      ? `+${trendDelta} vs last week`
      : `${trendDelta} vs last week`
  const badges = getBadges({
    totalCheckIns,
    dailyStreaks: todayGoals
      .filter((item) => item.goal.cadenceType === "DAILY")
      .map((item) => item.dailyStreak),
    weeklyGoals: todayGoals
      .filter((item) => item.goal.cadenceType === "WEEKLY")
      .map((item) => ({
        cadenceType: item.goal.cadenceType,
        weeklyTarget: item.goal.weeklyTarget,
        checkIns: item.checkIns.map((check) => ({ weekKey: check.weekKey })),
      })),
    timeZone: user.timezone,
    today: new Date(),
  })

  const reminderLabel =
    user.reminderFrequency === "WEEKDAYS" ? "Weekdays" : "Daily"

  return (
    <div id="dashboard" className="space-y-6">
      {!membership ? (
        <div className="rounded-2xl border border-dashed bg-background px-6 py-4 text-sm text-muted-foreground">
          You&apos;re not in a group yet.{" "}
          <a href="/group" className="text-foreground underline">
            Create or join one
          </a>{" "}
          when you&apos;re ready for accountability.
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Keep your goals on track with one‑tap check‑ins.
          </p>
        </div>
        <FocusModeToggle targetId="dashboard" />
      </div>

      {hasMissingToday ? (
        <div className="rounded-2xl border border-dashed bg-background px-6 py-4 text-sm text-muted-foreground">
          You haven&apos;t completed a goal today. A quick tap keeps your streak alive.
        </div>
      ) : null}

      <Card className="border bg-card/70 shadow-sm backdrop-blur" data-focus-hide="true">
        <CardContent className="grid gap-4 p-6 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Weekly score</div>
            <div className="text-3xl font-semibold">{weeklyScore} points</div>
            <div className="text-sm text-muted-foreground">{trendLabel}</div>
            <div className="text-sm text-muted-foreground">
              Best streak: {maxDailyStreak} days
            </div>
            {pendingGoal ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CheckInButton
                  goalId={pendingGoal.goal.id}
                  completed={pendingGoal.todayDone}
                  label={`Complete: ${pendingGoal.goal.name}`}
                />
                <span className="text-xs text-muted-foreground">
                  One tap logs today&apos;s progress.
                </span>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                You&apos;re fully completed for today.
              </div>
            )}
          </div>
          <div className="flex items-center justify-center">
            <CompletionRing value={streakProgress} label="Streak progress" />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card id="today">
          <CardHeader>
            <CardTitle>Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayGoals.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-background p-4 text-sm text-muted-foreground">
                No goals yet.{" "}
                <a href="/goals" className="text-foreground underline">
                  Create your first goal
                </a>{" "}
                to start tracking.
              </div>
            ) : (
            todayGoals.map(({ goal, todayDone, checkInsThisWeek, checkIns }) => {
                const weeklyTarget = goal.weeklyTarget ?? 1
                const isWeekly =
                  goal.cadenceType === "WEEKLY" && goal.weeklyTarget != null
                const weekTarget = isWeekly ? weeklyTarget : 7
                const weekProgress = Math.min(
                  100,
                  Math.round((checkInsThisWeek.length / weekTarget) * 100)
                )
                const last7Keys = Array.from({ length: 7 }).map((_, index) =>
                  getLocalDateKey(subDays(now, 6 - index), user.timezone)
                )
                const counts = last7Keys.map(
                  (key) =>
                    checkIns.filter((check) => check.localDateKey === key).length
                )
                const last14Keys = Array.from({ length: 14 }).map((_, index) =>
                  getLocalDateKey(subDays(now, 13 - index), user.timezone)
                )
                const sparkValues = last14Keys.map(
                  (key) =>
                    checkIns.filter((check) => check.localDateKey === key).length
                )

                return (
                  <div
                    key={goal.id}
                    className="flex flex-col gap-3 rounded-2xl border bg-background p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{goal.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {goal.cadenceType === "DAILY"
                            ? "Daily"
                            : `Weekly target: ${goal.weeklyTarget}x`}
                        </div>
                      </div>
                      <CheckInButton
                        goalId={goal.id}
                        completed={todayDone}
                        label="Complete"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>This week</span>
                        <span>
                          {checkInsThisWeek.length}/{weekTarget}
                        </span>
                      </div>
                      <Progress value={weekProgress} />
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            todayDone ? "bg-emerald-500" : "bg-muted"
                          }`}
                        />
                        {todayDone ? "Completed today" : "Not completed today"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>Last 7 days</span>
                        <TinyHeatmap counts={counts} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Streak history</span>
                        <Sparkline values={sparkValues} />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
        <Card data-focus-hide="true">
          <CardHeader>
            <CardTitle>Streaks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayGoals.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Streaks will appear once you start completing goals.
              </div>
            ) : (
              todayGoals.map(({ goal, dailyStreak, weeklyStreak }) => (
                <div
                  key={goal.id}
                  className="flex items-center justify-between rounded-xl border bg-background px-3 py-2"
                >
                  <div className="text-sm font-medium">{goal.name}</div>
                  <Badge variant="secondary">
                    {goal.cadenceType === "DAILY"
                      ? `${dailyStreak} day streak`
                      : `${weeklyStreak} week streak`}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card data-focus-hide="true">
        <CardHeader>
          <CardTitle>Weekly planning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {todayGoals.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Add goals to see your weekly plan.
            </div>
          ) : (
            todayGoals.map(({ goal, checkInsThisWeek }) => {
              const weeklyTarget =
                goal.cadenceType === "WEEKLY" && goal.weeklyTarget
                  ? goal.weeklyTarget
                  : 7
              const expectedByNow =
                goal.cadenceType === "WEEKLY" && goal.weeklyTarget
                  ? Math.ceil((goal.weeklyTarget * daysElapsed) / 7)
                  : daysElapsed
              const onTrack = checkInsThisWeek.length >= expectedByNow
              const remainingRequired = Math.max(
                0,
                weeklyTarget - checkInsThisWeek.length
              )
              const remainingDays = Math.max(0, 7 - daysElapsed)
              const atRisk = remainingRequired > remainingDays
              const progress = Math.min(
                100,
                Math.round((checkInsThisWeek.length / weeklyTarget) * 100)
              )

              return (
                <div
                  key={goal.id}
                  className="rounded-2xl border bg-background p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{goal.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {goal.cadenceType === "DAILY"
                          ? "Daily"
                          : `Weekly target: ${goal.weeklyTarget}x`}
                      </div>
                    </div>
                    <Badge
                      variant={onTrack ? "secondary" : "outline"}
                      className={atRisk ? "bg-destructive/10 text-destructive" : ""}
                    >
                      {atRisk ? "At risk" : onTrack ? "On track" : "Behind"}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress this week</span>
                      <span>
                        {checkInsThisWeek.length}/{weeklyTarget}
                      </span>
                    </div>
                    <Progress value={progress} />
                    <div className="text-[11px] text-muted-foreground">
                      Aim for {expectedByNow} by today
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card data-focus-hide="true">
        <CardHeader>
          <CardTitle>Badges</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {badges.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No badges yet. Your first completion unlocks one!
            </div>
          ) : (
            badges.map((badge) => (
              <Badge key={badge} variant="secondary">
                {badge}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]" data-focus-hide="true">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming reminders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>
              Next reminder:{" "}
              <span className="text-foreground">{user.reminderTime}</span>
            </div>
            <div>
              Frequency: <span className="text-foreground">{reminderLabel}</span>
            </div>
            <div>
              Best completion time:{" "}
              <span className="text-foreground">{bestTimeLabel}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Push/email reminders are coming soon. We&apos;ll notify you when
              they&apos;re ready.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Link href="/goals" className="block text-primary underline">
              View all goals
            </Link>
            <Link href="/group" className="block text-primary underline">
              Group dashboard
            </Link>
            <Link href="/settings" className="block text-primary underline">
              Update settings
            </Link>
          </CardContent>
        </Card>
      </section>

      {pendingGoal ? (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-3rem)] -translate-x-1/2 rounded-2xl border bg-background/90 p-3 shadow-lg backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Complete now</div>
              <div className="text-sm font-medium">{pendingGoal.goal.name}</div>
            </div>
            <Button asChild>
              <a href="#today">Go</a>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
