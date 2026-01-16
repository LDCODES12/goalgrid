import { getServerSession } from "next-auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getLocalDateKey, getWeekKey } from "@/lib/time"
import {
  computeDailyStreak,
  summarizeDailyCheckIns,
} from "@/lib/scoring"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { GoalCreateForm } from "@/components/goal-create-form"
import { CheckInButton } from "@/components/check-in-button"

export default async function GoalsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/auth/signin")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) redirect("/auth/signin")

  const goals = await prisma.goal.findMany({
    where: { ownerId: user.id, active: true },
    include: { checkIns: true },
    orderBy: { createdAt: "desc" },
  })

  const todayKey = getLocalDateKey(new Date(), user.timezone)
  const weekKey = getWeekKey(new Date(), user.timezone)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your goals</h1>
        <p className="text-sm text-muted-foreground">
          Build small wins every day. Weekly targets help you stay flexible.
        </p>
      </div>

      <GoalCreateForm />

      <Card>
        <CardHeader>
          <CardTitle>Active goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {goals.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No goals yet. Create one above.
            </div>
          ) : (
            goals.map((goal) => {
              const checkIns = goal.checkIns.filter(
                (check) => check.userId === user.id
              )
              const todayDone = checkIns.some(
                (check) => check.localDateKey === todayKey
              )
              const weekCheckIns = checkIns.filter(
                (check) => check.weekKey === weekKey
              )
              const weeklyTarget = goal.weeklyTarget ?? 1
              const isWeekly =
                goal.cadenceType === "WEEKLY" && goal.weeklyTarget != null
              const weekTarget = isWeekly ? weeklyTarget : 7
              const weekProgress = Math.min(
                100,
                Math.round((weekCheckIns.length / weekTarget) * 100)
              )
              const streak = computeDailyStreak(
                summarizeDailyCheckIns(checkIns),
                todayKey
              )

              return (
                <div
                  key={goal.id}
                  className="rounded-2xl border bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/goals/${goal.id}`}
                        className="text-base font-semibold"
                      >
                        {goal.name}
                      </Link>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {goal.cadenceType === "DAILY"
                          ? "Daily"
                          : `Weekly target: ${goal.weeklyTarget}x`}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Badge variant="secondary">{streak} day streak</Badge>
                      </div>
                    </div>
                    <CheckInButton
                      goalId={goal.id}
                      completed={todayDone}
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>This week</span>
                      <span>
                        {weekCheckIns.length}/{weekTarget}
                      </span>
                    </div>
                    <Progress value={weekProgress} />
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          todayDone ? "bg-emerald-500" : "bg-muted"
                        }`}
                      />
                      {todayDone ? "Checked in today" : "Not checked in today"}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
