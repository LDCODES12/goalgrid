import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getLocalDateKey, getWeekKey, getWeekStart } from "@/lib/time"
import {
  computeDailyStreak,
  computeWeeklyStreak,
  computeWeeklyPoints,
  computeConsistencyPercentage,
  computeGracefulStreak,
  summarizeDailyCheckIns,
  summarizeWeeklyCheckIns,
} from "@/lib/scoring"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CompletionRing } from "@/components/completion-ring"
import { CheerButton } from "@/components/cheer-button"
import { RemindButton } from "@/components/remind-button"
import { GroupSetup } from "@/components/group-setup"
import { InviteLinkCard } from "@/components/invite-link-card"
import { WeeklySummaryCard } from "@/components/weekly-summary-card"
import { computeWeeklySummary } from "@/lib/weekly-summary"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function GroupPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/auth/signin")

  const membership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id },
    include: { group: true },
  })
  if (!membership) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Create or join a group</h1>
          <p className="text-sm text-muted-foreground">
            Groups keep everyone accountable. Use an invite code or start your
            own.
          </p>
        </div>
        <GroupSetup />
      </div>
    )
  }

  const group = await prisma.group.findUnique({
    where: { id: membership.groupId },
    include: {
      members: { include: { user: true } },
    },
  })
  if (!group) redirect("/dashboard")

  const goals = await prisma.goal.findMany({
    where: { groupId: group.id, active: true },
    include: { checkIns: true },
  })

  const recentCheckIns = await prisma.checkIn.findMany({
    where: { goal: { groupId: group.id } },
    include: { user: true, goal: true },
    orderBy: { timestamp: "desc" },
    take: 8,
  })

  const todaySnapshots = group.members.map((member) => {
    const userGoals = goals.filter((goal) => goal.ownerId === member.userId)
    const todayKey = getLocalDateKey(new Date(), member.user.timezone)
    const weekKey = getWeekKey(new Date(), member.user.timezone)
    const weekStart = getWeekStart(new Date(), member.user.timezone)

    return {
      member,
      goals: userGoals.map((goal) => {
        const checkIns = goal.checkIns.filter(
          (check) => check.userId === member.userId
        )
        const todayCheckIn = checkIns.find(
          (check) => check.localDateKey === todayKey
        )
        const dailyTarget = goal.dailyTarget ?? 1
        const todayCount = checkIns.filter((check) => check.localDateKey === todayKey).length
        const checkedToday = todayCount >= dailyTarget
        const isPartial = todayCheckIn?.isPartial ?? false
        const weekCount = checkIns.filter((check) => check.weekKey === weekKey)
          .length

        // Compute streaks and consistency
        const dateKeys = summarizeDailyCheckIns(checkIns)
        const dailyStreak = computeDailyStreak(dateKeys, todayKey, member.user.timezone, dailyTarget)
        const consistency = computeConsistencyPercentage(
          dateKeys, todayKey, member.user.timezone, 30, goal.createdAt, dailyTarget
        )
        const gracefulStreak = computeGracefulStreak(dateKeys, todayKey, member.user.timezone, goal.streakFreezes, dailyTarget)
        
        const weeklyStreak =
          goal.cadenceType === "WEEKLY" && goal.weeklyTarget
            ? computeWeeklyStreak(
                summarizeWeeklyCheckIns(checkIns),
                weekStart,
                member.user.timezone,
                goal.weeklyTarget
              )
            : 0

        return {
          goal,
          checkedToday,
          isPartial,
          weekCount,
          dailyStreak,
          consistency,
          gracefulStreak,
          weeklyStreak,
        }
      }),
    }
  })

  const leaderboard = group.members.map((member) => {
    const userGoals = goals.filter((goal) => goal.ownerId === member.userId)
    const userWeekKey = getWeekKey(new Date(), member.user.timezone)
    const userTodayKey = getLocalDateKey(new Date(), member.user.timezone)
    let totalPoints = 0
    let totalTarget = 0
    let totalCompleted = 0
    let completedToday = false

    for (const goal of userGoals) {
      const checkIns = goal.checkIns.filter(
        (check) => check.userId === member.userId
      )
      const checkInsThisWeek = checkIns.filter(
        (check) => check.weekKey === userWeekKey
      )
      const goalDailyTarget = goal.dailyTarget ?? 1
      const todayCount = checkIns.filter((check) => check.localDateKey === userTodayKey).length
      const todayDone = todayCount >= goalDailyTarget
      if (todayDone) completedToday = true

      const dailyStreak = computeDailyStreak(
        summarizeDailyCheckIns(checkIns),
        userTodayKey,
        member.user.timezone,
        goalDailyTarget
      )

      totalPoints += computeWeeklyPoints({
        goal,
        checkInsThisWeek: checkInsThisWeek.length,
        dailyStreak,
      })

      if (goal.cadenceType === "WEEKLY" && goal.weeklyTarget) {
        totalTarget += goal.weeklyTarget
        totalCompleted += Math.min(checkInsThisWeek.length, goal.weeklyTarget)
      } else {
        totalTarget += 7
        totalCompleted += Math.min(checkInsThisWeek.length, 7)
      }
    }

    const completionPct =
      totalTarget === 0 ? 0 : Math.round((totalCompleted / totalTarget) * 100)

    return {
      member,
      totalPoints,
      completionPct,
      completedToday,
    }
  })

  const sortedLeaderboard = [...leaderboard].sort(
    (a, b) => b.totalPoints - a.totalPoints
  )

  const pulseCompleted = sortedLeaderboard.filter((entry) => entry.completedToday).length

  // Compute weekly summary
  const weeklySummaryMembers = group.members.map((member) => ({
    id: member.userId,
    name: member.user.name,
    goals: goals
      .filter((g) => g.ownerId === member.userId)
      .map((g) => ({
        id: g.id,
        name: g.name,
        cadenceType: g.cadenceType,
        weeklyTarget: g.weeklyTarget,
        checkIns: g.checkIns
          .filter((c) => c.userId === member.userId)
          .map((c) => ({ weekKey: c.weekKey, localDateKey: c.localDateKey })),
      })),
  }))
  const weeklySummary = computeWeeklySummary(
    weeklySummaryMembers,
    session.user.id ? "America/Chicago" : "UTC" // Use a default timezone for group view
  )

  // Dynamically construct invite URL from request headers
  const headersList = await headers()
  const host = headersList.get("host") ?? "localhost:3000"
  const protocol = headersList.get("x-forwarded-proto") ?? "http"
  const baseUrl = `${protocol}://${host}`
  const inviteUrl = `${baseUrl}/group/join?code=${group.inviteCode}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {group.members.length} member{group.members.length !== 1 ? "s" : ""} • Code: <span className="font-medium text-foreground">{group.inviteCode}</span>
          </p>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="rounded-2xl border bg-gradient-to-br from-card to-card/50 p-6">
        <h2 className="text-lg font-semibold mb-4">Leaderboard</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedLeaderboard.map((entry, index) => (
            <div
              key={entry.member.id}
              className={`flex flex-col items-center gap-3 rounded-xl border bg-card p-4 ${
                index === 0 ? "border-amber-500/30 bg-amber-500/5" : ""
              }`}
            >
              {index === 0 && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Top Performer</span>
              )}
              <div className="font-medium">{entry.member.user.name}</div>
              <CompletionRing
                value={entry.completionPct}
                label="Weekly completion"
              />
              <div className="text-sm text-muted-foreground">
                {entry.totalPoints} points
              </div>
            </div>
          ))}
        </div>
      </div>

      <InviteLinkCard inviteUrl={inviteUrl} inviteCode={group.inviteCode} />

      <Tabs defaultValue="pulse" className="w-full">
        <TabsList>
          <TabsTrigger value="pulse">Pulse</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* PULSE TAB - Compact flat list */}
        <TabsContent value="pulse" className="mt-3">
          <div className="rounded-lg border bg-card">
            {/* Minimal header */}
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-sm font-medium">Today&apos;s pulse</span>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  done
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  pending
                </span>
                <span className="tabular-nums">{pulseCompleted}/{sortedLeaderboard.length} active</span>
              </div>
            </div>

            {/* Member rows */}
            <div className="divide-y">
              {todaySnapshots.map((entry) => {
                const dailyGoals = entry.goals.filter(
                  (g) => g.goal.cadenceType === "DAILY"
                )
                const weeklyGoals = entry.goals.filter(
                  (g) => g.goal.cadenceType === "WEEKLY"
                )
                const completedCount = entry.goals.filter((g) => g.checkedToday).length
                const needsReminder = dailyGoals.some((g) => !g.checkedToday)

                return (
                  <div key={entry.member.id} className="px-3 py-2">
                    {/* Member name row */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{entry.member.user.name}</span>
                      {entry.goals.length > 0 && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {completedCount}/{entry.goals.length}
                        </span>
                      )}
                    </div>

                    {entry.goals.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No goals</span>
                    ) : (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {/* Daily goals - inline with icon */}
                        {dailyGoals.map((g) => (
                          <div key={g.goal.id} className="flex items-center gap-1 text-xs">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                g.checkedToday ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                            />
                            <span className={g.checkedToday ? "text-muted-foreground" : ""}>
                              {g.goal.name}
                            </span>
                          </div>
                        ))}

                        {/* Weekly goals - inline with progress */}
                        {weeklyGoals.map((g) => {
                          const target = g.goal.weeklyTarget ?? 1
                          const progress = Math.min(100, Math.round((g.weekCount / target) * 100))
                          const isComplete = g.weekCount >= target

                          return (
                            <div key={g.goal.id} className="flex items-center gap-1.5 text-xs">
                              {isComplete && (
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              )}
                              <span className={isComplete ? "text-muted-foreground" : ""}>
                                {g.goal.name}
                              </span>
                              <Progress value={progress} className="h-1 w-10" />
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {g.weekCount}/{target}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Remind button - compact */}
                    {needsReminder && entry.member.user.id !== session.user.id && (
                      <div className="mt-1.5">
                        <RemindButton
                          recipientId={entry.member.user.id}
                          recipientName={entry.member.user.name}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </TabsContent>

        {/* SUMMARY TAB - Weekly group summary */}
        <TabsContent value="summary" className="mt-3">
          <WeeklySummaryCard data={weeklySummary} />
        </TabsContent>

        {/* DETAILS TAB - Compact single-line goal rows */}
        <TabsContent value="details" className="mt-3 space-y-3">
          <div className="rounded-lg border bg-card divide-y">
            {todaySnapshots.map((entry) => {
              const leaderboardEntry = sortedLeaderboard.find(
                (l) => l.member.id === entry.member.id
              )
              const rank =
                sortedLeaderboard.findIndex((l) => l.member.id === entry.member.id) + 1

              return (
                <div key={entry.member.id}>
                  {/* Member header - single line */}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                    <span className="text-sm font-medium">{entry.member.user.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {leaderboardEntry?.totalPoints ?? 0} pts · #{rank}
                    </span>
                  </div>

                  {/* Goal rows */}
                  {entry.goals.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No goals
                    </div>
                  ) : (
                    <div className="divide-y divide-dashed">
                      {entry.goals.map((g) => {
                        const isDaily = g.goal.cadenceType === "DAILY"
                        const target = isDaily ? 7 : (g.goal.weeklyTarget ?? 1)
                        const progress = Math.min(100, Math.round((g.weekCount / target) * 100))

                        return (
                          <div
                            key={g.goal.id}
                            className="flex items-center gap-3 px-3 py-1.5 text-xs"
                          >
                            {/* Today status dot */}
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                g.checkedToday 
                                  ? g.isPartial 
                                    ? "bg-amber-500" 
                                    : "bg-emerald-500" 
                                  : "bg-muted"
                              }`}
                            />
                            {/* Goal name */}
                            <span className="flex-1 truncate font-medium">{g.goal.name}</span>
                            {/* Cadence */}
                            <span className="text-muted-foreground w-14 shrink-0">
                              {isDaily ? "daily" : `${g.goal.weeklyTarget}x/wk`}
                            </span>
                            {/* Progress bar */}
                            <Progress value={progress} className="h-1 w-12 shrink-0" />
                            {/* Count */}
                            <span className="text-muted-foreground tabular-nums w-8 shrink-0 text-right">
                              {g.weekCount}/{target}
                            </span>
                            {/* Consistency % */}
                            <span className="text-muted-foreground tabular-nums w-10 shrink-0 text-right">
                              {g.consistency}%
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Recent Activity - compact */}
          <div className="rounded-lg border bg-card">
            <div className="px-3 py-2 border-b">
              <span className="text-sm font-medium">Recent activity</span>
            </div>
            <div className="divide-y">
              {recentCheckIns.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No completions yet.
                </div>
              ) : (
                recentCheckIns.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-1.5 text-xs"
                  >
                    <span>
                      <span className="text-muted-foreground">{item.user.name}</span>
                      {" · "}
                      <span className="font-medium">{item.goal.name}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <CheerButton name={item.user.name} />
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {item.timestamp.toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

    </div>
  )
}
