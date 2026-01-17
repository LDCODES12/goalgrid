import { getServerSession } from "next-auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getLocalDateKey, getWeekKey, getWeekStart } from "@/lib/time"
import { formatInTimeZone } from "date-fns-tz"
import { subDays } from "date-fns"
import {
  computeDailyStreak,
  computeBestDailyStreak,
  computeWeeklyPoints,
  computeWeeklyStreak,
  computeConsistencyPercentage,
  computeGracefulStreak,
  countRecentCompletions,
  getSoftFailureMessage,
  summarizeDailyCheckIns,
  summarizeWeeklyCheckIns,
} from "@/lib/scoring"
import { getBadges } from "@/lib/badges"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckInButton } from "@/components/check-in-button"
import { CompletionRing } from "@/components/completion-ring"
import { FocusModeToggle } from "@/components/focus-mode-toggle"
import { TinyHeatmap } from "@/components/tiny-heatmap"
import { Sparkline } from "@/components/sparkline"
import { DismissRemindersButton } from "@/components/dismiss-reminders-button"
import { DraggableDashboardGoals } from "@/components/draggable-dashboard-goals"
import { PointsBackfill } from "@/components/points-backfill"

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
    orderBy: { sortOrder: "asc" },
  })

  const reminders = await prisma.reminder.findMany({
    where: { recipientId: user.id, readAt: null },
    include: { sender: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  })
  const reminderItems = reminders.map((reminder) => ({
    id: reminder.id,
    senderName: reminder.sender.name,
    message: reminder.message,
  }))

  // Fetch recent cheers on user's check-ins (last 7 days)
  const recentCheers = await prisma.cheer.findMany({
    where: {
      checkIn: { userId: user.id },
      createdAt: { gte: subDays(new Date(), 7) },
    },
    include: {
      sender: { select: { name: true } },
      checkIn: { include: { goal: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  // Check if user needs points backfill (has check-ins but no ledger entries)
  const userCheckInCount = await prisma.checkIn.count({ where: { userId: user.id } })
  const userLedgerCount = await prisma.pointLedger.count({ where: { userId: user.id } })
  const needsBackfill = userCheckInCount > 0 && userLedgerCount === 0

  const todayKey = getLocalDateKey(new Date(), user.timezone)
  const now = new Date()
  const weekKey = getWeekKey(now, user.timezone)
  const weekStart = getWeekStart(now, user.timezone)
  const lastWeekKey = getWeekKey(subDays(now, 7), user.timezone)
  const weekdayNumber = Number(formatInTimeZone(now, user.timezone, "i"))
  const daysElapsed = Math.max(1, Math.min(7, weekdayNumber))

  const todayGoals = goals.map((goal) => {
    const checkIns = goal.checkIns.filter((check) => check.userId === user.id)
    const todayCheckIns = checkIns.filter((check) => check.localDateKey === todayKey)
    const todayCount = todayCheckIns.length
    const dailyTarget = goal.dailyTarget ?? 1
    const todayDone = todayCount >= dailyTarget
    const todayPartial = todayCheckIns.length > 0 && todayCheckIns[0]?.isPartial && dailyTarget === 1
    const checkInsThisWeek = checkIns.filter(
      (check) => check.weekKey === weekKey
    )

    const dateKeys = summarizeDailyCheckIns(checkIns)
    const dailyStreak = computeDailyStreak(dateKeys, todayKey, user.timezone, dailyTarget)
    const bestStreak = computeBestDailyStreak(dateKeys, user.timezone, dailyTarget)
    const consistency = computeConsistencyPercentage(
      dateKeys, todayKey, user.timezone, 30, goal.createdAt, dailyTarget
    )
    const recentCompletions = countRecentCompletions(dateKeys, todayKey, user.timezone, 30, dailyTarget)
    const gracefulStreak = computeGracefulStreak(dateKeys, todayKey, user.timezone, goal.streakFreezes, dailyTarget)
    
    const weeklyCounts = summarizeWeeklyCheckIns(checkIns)
    const weeklyStreak =
      goal.cadenceType === "WEEKLY" && goal.weeklyTarget
        ? computeWeeklyStreak(weeklyCounts, weekStart, user.timezone, goal.weeklyTarget)
        : 0

    // Get soft failure message if needed
    const softMessage = goal.cadenceType === "DAILY" && !todayDone
      ? getSoftFailureMessage(consistency, recentCompletions, 30)
      : null

    // Compute additional data for the draggable goals component
    const weeklyTargetVal = goal.weeklyTarget ?? 1
    const isWeekly = goal.cadenceType === "WEEKLY" && goal.weeklyTarget != null
    // For daily goals: weekTarget = dailyTarget * 7 (e.g., 3x/day = 21/week)
    const weekTarget = isWeekly ? weeklyTargetVal : dailyTarget * 7
    const weekProgress = Math.min(100, Math.round((checkInsThisWeek.length / weekTarget) * 100))
    const last7Keys = Array.from({ length: 7 }).map((_, index) =>
      getLocalDateKey(subDays(now, 6 - index), user.timezone)
    )
    const counts = last7Keys.map(
      (key) => checkIns.filter((check) => check.localDateKey === key).length
    )
    const last14Keys = Array.from({ length: 14 }).map((_, index) =>
      getLocalDateKey(subDays(now, 13 - index), user.timezone)
    )
    const sparkValues = last14Keys.map(
      (key) => checkIns.filter((check) => check.localDateKey === key).length
    )
    const hasMultiTarget = dailyTarget > 1

    return {
      goal,
      todayDone,
      todayPartial,
      todayCount,
      dailyTarget,
      checkInsThisWeek,
      dailyStreak,
      bestStreak,
      consistency,
      gracefulStreak,
      weeklyStreak,
      weekTarget,
      weekProgress,
      counts,
      sparkValues,
      hasMultiTarget,
      checkIns,
      softMessage,
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
  
  // Use new points system from user stored values
  const weeklyScore = user.pointsWeekKey === weekKey 
    ? Math.floor(user.pointsWeekMilli / 1000)
    : 0
  const lifetimePoints = Math.floor(user.pointsLifetimeMilli / 1000)
  
  // Get last week's points from ledger for trend comparison
  const lastWeekLedger = await prisma.pointLedger.aggregate({
    where: { userId: user.id, weekKey: lastWeekKey },
    _sum: { pointsMilli: true },
  })
  const lastWeekScore = Math.floor((lastWeekLedger._sum.pointsMilli ?? 0) / 1000)

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
      {/* Auto-backfill points for existing users */}
      {needsBackfill && (
        <PointsBackfill hasCheckIns={userCheckInCount > 0} hasLedgerEntries={userLedgerCount > 0} />
      )}
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Keep your goals on track with one‑tap completions.
          </p>
        </div>
        <FocusModeToggle targetId="dashboard" />
      </div>

      {/* Alerts */}
      {!membership ? (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm">
          <span className="text-muted-foreground">You&apos;re flying solo. </span>
          <a href="/group" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            Create or join a group
          </a>
          <span className="text-muted-foreground"> for accountability.</span>
        </div>
      ) : null}

      {hasMissingToday ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          You have goals waiting today. Even a quick check-in counts toward your consistency.
        </div>
      ) : null}

      {/* Notifications - Reminders and Cheers */}
      {(reminderItems.length > 0 || recentCheers.length > 0) && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="text-sm font-medium">Notifications</div>
          
          {/* Reminders */}
          {reminderItems.length > 0 && (
            <div className="space-y-1.5">
              {reminderItems.map((reminder) => (
                <div 
                  key={reminder.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2"
                >
                  <div className="text-sm">
                    <span className="font-medium">{reminder.senderName}</span>
                    <span className="text-muted-foreground">: {reminder.message}</span>
                  </div>
                  <DismissRemindersButton reminderIds={[reminder.id]} />
                </div>
              ))}
            </div>
          )}
          
          {/* Cheers */}
          {recentCheers.length > 0 && (
            <div className="space-y-1.5">
              {recentCheers.map((cheer) => (
                <div 
                  key={cheer.id}
                  className="flex items-center justify-between text-sm rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2"
                >
                  <span>
                    <span className="text-emerald-600 dark:text-emerald-400">👏</span>{" "}
                    <span className="font-medium">{cheer.sender.name}</span>
                    <span className="text-muted-foreground"> cheered your </span>
                    <span className="font-medium">{cheer.checkIn.goal.name}</span>
                    <span className="text-muted-foreground"> completion</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {cheer.createdAt.toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hero Stats Card */}
      <div className="rounded-2xl border bg-gradient-to-br from-card to-card/50 p-6 shadow-sm" data-focus-hide="true">
        <div className="grid gap-6 md:grid-cols-[1.5fr_1fr] md:items-center">
          <div className="space-y-4">
            <div className="flex items-baseline gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">This week</div>
                <div className="mt-1 text-4xl font-bold tracking-tight">{weeklyScore} <span className="text-lg font-normal text-muted-foreground">points</span></div>
              </div>
              <div className="hidden sm:block border-l pl-4 ml-2">
                <div className="text-sm font-medium text-muted-foreground">Lifetime</div>
                <div className="mt-1 text-2xl font-semibold text-muted-foreground">{lifetimePoints.toLocaleString()}</div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${trendLabel.includes("+") ? "bg-emerald-500" : trendLabel.includes("-") ? "bg-red-500" : "bg-muted"}`} />
                <span className="text-muted-foreground">{trendLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Best: {maxDailyStreak} days</span>
              </div>
            </div>

            {!pendingGoal && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                All caught up for today
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-center">
            <CompletionRing value={streakProgress} label="Streak progress" />
          </div>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div id="today" className="space-y-4">
          <h2 className="text-lg font-semibold">Today&apos;s Goals</h2>
          
          <DraggableDashboardGoals 
            goals={todayGoals.map(item => ({
              goal: {
                id: item.goal.id,
                name: item.goal.name,
                cadenceType: item.goal.cadenceType,
                weeklyTarget: item.goal.weeklyTarget,
              },
              todayDone: item.todayDone,
              todayPartial: item.todayPartial,
              todayCount: item.todayCount,
              dailyTarget: item.dailyTarget,
              checkInsThisWeek: item.checkInsThisWeek.map(c => ({ id: c.id })),
              consistency: item.consistency,
              weekTarget: item.weekTarget,
              weekProgress: item.weekProgress,
              counts: item.counts,
              sparkValues: item.sparkValues,
              hasMultiTarget: item.hasMultiTarget,
            }))}
          />
        </div>
        
        {/* Progress Sidebar */}
        <div className="space-y-4" data-focus-hide="true">
          <h2 className="text-lg font-semibold">Progress</h2>
          
          {todayGoals.length === 0 ? (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Progress will appear once you start completing goals.
            </div>
          ) : (
            <div className="space-y-3">
              {todayGoals.map(({ goal, dailyStreak, bestStreak, consistency, gracefulStreak, weeklyStreak, softMessage }) => (
                <div
                  key={goal.id}
                  className="rounded-xl border bg-card p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <Link href={`/goals/${goal.id}`} className="text-sm font-medium hover:underline">
                      {goal.name}
                    </Link>
                    <Badge variant="secondary">
                      {consistency}% consistency
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {goal.cadenceType === "DAILY" ? (
                      <>
                        <span>Current: {gracefulStreak.currentStreak}d</span>
                        <span>·</span>
                        <span>Best: {bestStreak}d</span>
                        {gracefulStreak.freezesUsed > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-amber-500">{gracefulStreak.freezesUsed} freeze used</span>
                          </>
                        )}
                        {gracefulStreak.isAtRisk && (
                          <>
                            <span>·</span>
                            <span className="text-amber-500">At risk!</span>
                          </>
                        )}
                      </>
                    ) : (
                      <span>{weeklyStreak} week streak</span>
                    )}
                  </div>
                  {softMessage && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                      {softMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Weekly Planning */}
      <div className="space-y-4" data-focus-hide="true">
        <h2 className="text-lg font-semibold">Weekly Planning</h2>
        
        {todayGoals.length === 0 ? (
          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            Add goals to see your weekly plan.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {todayGoals.map(({ goal, checkInsThisWeek, dailyTarget }) => {
              const isWeeklyGoal = goal.cadenceType === "WEEKLY" && goal.weeklyTarget != null
              // For daily goals: weeklyTarget = dailyTarget * 7 (e.g., 3x/day = 21/week)
              const targetThisWeek = isWeeklyGoal ? goal.weeklyTarget! : dailyTarget * 7
              const done = checkInsThisWeek.length
              const remainingRequired = Math.max(0, targetThisWeek - done)
              const remainingDays = Math.max(0, 7 - daysElapsed)
              const remainingCheckIns = remainingDays * dailyTarget // Max possible check-ins remaining
              const progress = Math.min(100, Math.round((done / targetThisWeek) * 100))
              
              // Expected check-ins so far (for daily: dailyTarget * daysElapsed)
              const expectedSoFar = isWeeklyGoal 
                ? Math.ceil((goal.weeklyTarget! * daysElapsed) / 7) 
                : dailyTarget * daysElapsed
              const canStillComplete = isWeeklyGoal 
                ? remainingRequired <= remainingDays 
                : remainingRequired <= remainingCheckIns
              const isComplete = done >= targetThisWeek
              const isPerfect = done >= expectedSoFar

              // Status label logic - consistent for both goal types
              let statusLabel: string
              let statusStyle: string
              
              if (isComplete) {
                statusLabel = "Complete"
                statusStyle = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              } else if (isPerfect) {
                statusLabel = "On track"
                statusStyle = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              } else if (!canStillComplete) {
                statusLabel = "Will miss"
                statusStyle = "bg-red-500/10 text-red-600 dark:text-red-400"
              } else {
                statusLabel = "Behind"
                statusStyle = "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }

              return (
                <div
                  key={goal.id}
                  className={`rounded-xl border bg-card p-4 ${
                    isComplete || isPerfect ? "border-emerald-500/30" : !canStillComplete ? "border-red-500/30" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/goals/${goal.id}`} className="font-medium truncate hover:underline">
                      {goal.name}
                    </Link>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${statusStyle}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span>{done}/{targetThisWeek} this week</span>
                      <span>{remainingRequired > 0 ? `${remainingRequired} left` : "Done!"}</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="space-y-4" data-focus-hide="true">
          <h2 className="text-lg font-semibold">Badges</h2>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span 
                key={badge} 
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer Grid */}
      <div className="grid gap-4 md:grid-cols-2" data-focus-hide="true">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold mb-3">Reminders</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Next reminder</span>
              <span className="font-medium">{user.reminderTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frequency</span>
              <span className="font-medium">{reminderLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Best time</span>
              <span className="font-medium">{bestTimeLabel}</span>
            </div>
          </div>
        </div>
        
      </div>

    </div>
  )
}
