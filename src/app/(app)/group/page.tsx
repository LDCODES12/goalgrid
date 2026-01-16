import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getLocalDateKey, getWeekKey } from "@/lib/time"
import {
  computeDailyStreak,
  computeWeeklyPoints,
  summarizeDailyCheckIns,
} from "@/lib/scoring"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CompletionRing } from "@/components/completion-ring"
import { CheerButton } from "@/components/cheer-button"
import { RemindButton } from "@/components/remind-button"
import { GroupSetup } from "@/components/group-setup"
import { InviteLinkCard } from "@/components/invite-link-card"

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

    return {
      member,
      goals: userGoals.map((goal) => {
        const checkIns = goal.checkIns.filter(
          (check) => check.userId === member.userId
        )
        const checkedToday = checkIns.some(
          (check) => check.localDateKey === todayKey
        )
        const weekCount = checkIns.filter((check) => check.weekKey === weekKey)
          .length
        return {
          goal,
          checkedToday,
          weekCount,
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
    let checkedInToday = false

    for (const goal of userGoals) {
      const checkIns = goal.checkIns.filter(
        (check) => check.userId === member.userId
      )
      const checkInsThisWeek = checkIns.filter(
        (check) => check.weekKey === userWeekKey
      )
      const todayDone = checkIns.some(
        (check) => check.localDateKey === userTodayKey
      )
      if (todayDone) checkedInToday = true

      const dailyStreak = computeDailyStreak(
        summarizeDailyCheckIns(checkIns),
        userTodayKey
      )

      totalPoints += computeWeeklyPoints({
        goal,
        checkInsThisWeek,
        currentStreak: dailyStreak,
        timeZone: member.user.timezone,
        today: new Date(),
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
      checkedInToday,
    }
  })

  const sortedLeaderboard = [...leaderboard].sort(
    (a, b) => b.totalPoints - a.totalPoints
  )

  const nudges = sortedLeaderboard.filter((entry) => !entry.checkedInToday)
  const pulseCheckedIn = sortedLeaderboard.filter((entry) => entry.checkedInToday).length
  const pulsePct =
    sortedLeaderboard.length === 0
      ? 0
      : Math.round((pulseCheckedIn / sortedLeaderboard.length) * 100)

  const baseUrl =
    process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  const inviteUrl = `${baseUrl}/group/join?code=${group.inviteCode}`

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{group.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Invite code: <span className="font-medium">{group.inviteCode}</span>
            </p>
          </div>
          <Badge variant="outline">{group.members.length} members</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {sortedLeaderboard.map((entry) => (
              <div
                key={entry.member.id}
                className="flex flex-col items-center gap-2 rounded-2xl border bg-background p-4"
              >
                <div className="text-sm font-medium">
                  {entry.member.user.name}
                </div>
                <CompletionRing
                  value={entry.completionPct}
                  label="Weekly completion"
                />
                <div className="text-xs text-muted-foreground">
                  {entry.totalPoints} points
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <InviteLinkCard inviteUrl={inviteUrl} inviteCode={group.inviteCode} />

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLeaderboard.map((entry, index) => (
                  <TableRow key={entry.member.id}>
                    <TableCell>
                      {index + 1}. {entry.member.user.name}
                    </TableCell>
                    <TableCell>{entry.totalPoints}</TableCell>
                    <TableCell>
                      {entry.checkedInToday ? (
                        <Badge variant="secondary">Checked in</Badge>
                      ) : (
                        <Badge variant="outline">Not yet</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Group progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-background px-3 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Completed today</span>
                <span className="font-medium">
                  {pulseCheckedIn}/{sortedLeaderboard.length}
                </span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${pulsePct}%` }}
                />
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {todaySnapshots.map((entry) => (
                <div
                  key={entry.member.id}
                  className="rounded-xl border bg-background px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{entry.member.user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.goals.filter((goal) => goal.checkedToday).length}/
                      {entry.goals.length} completed
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {entry.goals.length === 0 ? (
                      <div>No goals yet.</div>
                    ) : (
                      entry.goals.slice(0, 2).map((goal) => (
                        <div
                          key={goal.goal.id}
                          className="flex items-center justify-between"
                        >
                          <span className="truncate">{goal.goal.name}</span>
                          <span
                            className={`h-2 w-2 rounded-full ${
                              goal.checkedToday
                                ? "bg-emerald-500"
                                : "bg-muted"
                            }`}
                          />
                        </div>
                      ))
                    )}
                    {entry.goals.length > 2 ? (
                      <div>+ {entry.goals.length - 2} more</div>
                    ) : null}
                  </div>
                  {entry.goals.some((goal) => !goal.checkedToday) ? (
                    <div className="mt-2">
                      <RemindButton name={entry.member.user.name} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Today’s snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {todaySnapshots.map((entry) => (
            <div
              key={entry.member.id}
              className="rounded-2xl border bg-background p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">
                  {entry.member.user.name}
                </div>
                <Badge variant="secondary">
                  {entry.goals.filter((goal) => goal.checkedToday).length}/
                  {entry.goals.length} completed
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {entry.goals.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    No goals yet.
                  </div>
                ) : (
                  entry.goals.map((goal) => (
                    <div
                      key={goal.goal.id}
                      className="rounded-xl border px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{goal.goal.name}</span>
                        <span className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              goal.checkedToday
                                ? "bg-emerald-500"
                                : "bg-muted"
                            }`}
                          />
                          <span className="text-muted-foreground">
                            {goal.checkedToday ? "Done" : "Not yet"}
                          </span>
                        </span>
                      </div>
                      {goal.goal.cadenceType === "WEEKLY" &&
                      goal.goal.weeklyTarget ? (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Weekly progress</span>
                            <span>
                              {Math.min(
                                goal.weekCount,
                                goal.goal.weeklyTarget
                              )}
                              /{goal.goal.weeklyTarget}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted">
                            <div
                              className="h-1.5 rounded-full bg-primary"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round(
                                    (goal.weekCount /
                                      goal.goal.weeklyTarget) *
                                      100
                                  )
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          Daily goal · {goal.checkedToday ? "Completed" : "Due today"}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentCheckIns.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No completions yet. Be the first to log progress.
            </div>
          ) : (
            recentCheckIns.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm"
              >
                <span>
                  {item.user.name} completed:{" "}
                  <span className="font-medium">{item.goal.name}</span>
                </span>
                <div className="flex items-center gap-3">
                  <CheerButton name={item.user.name} />
                  <span className="text-xs text-muted-foreground">
                    {item.timestamp.toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
