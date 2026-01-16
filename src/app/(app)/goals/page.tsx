import { getServerSession } from "next-auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getLocalDateKey, getWeekKey } from "@/lib/time"
import {
  computeDailyStreak,
  computeConsistencyPercentage,
  computeGracefulStreak,
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
              const todayCheckIn = checkIns.find(
                (check) => check.localDateKey === todayKey
              )
              const todayDone = !!todayCheckIn
              const todayPartial = todayCheckIn?.isPartial ?? false
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
              const dateKeys = summarizeDailyCheckIns(checkIns)
              const gracefulStreak = computeGracefulStreak(
                dateKeys,
                todayKey,
                user.timezone,
                goal.streakFreezes
              )
              const consistency = computeConsistencyPercentage(
                dateKeys,
                todayKey,
                user.timezone,
                30
              )

              return (
                <div
                  key={goal.id}
                  className="rounded-2xl border bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/goals/${goal.id}`}
                          className="text-base font-semibold"
                        >
                          {goal.name}
                        </Link>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {consistency}%
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {goal.cadenceType === "DAILY"
                          ? "Daily"
                          : `Weekly target: ${goal.weeklyTarget}x`}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{gracefulStreak.currentStreak}d streak</span>
                        {gracefulStreak.freezesUsed > 0 && (
                          <span className="text-amber-500">
                            ({gracefulStreak.freezesUsed} freeze)
                          </span>
                        )}
                        {gracefulStreak.isAtRisk && (
                          <span className="text-amber-500">At risk!</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!todayDone && goal.cadenceType === "DAILY" && (
                        <CheckInButton
                          goalId={goal.id}
                          completed={false}
                          label="Mini"
                          isPartial={true}
                        />
                      )}
                      <CheckInButton
                        goalId={goal.id}
                        completed={todayDone && !todayPartial}
                        label={todayPartial ? "Upgrade" : "Complete"}
                      />
                    </div>
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
                          todayDone 
                            ? todayPartial 
                              ? "bg-amber-500" 
                              : "bg-emerald-500" 
                            : "bg-muted"
                        }`}
                      />
                      {todayDone 
                        ? todayPartial 
                          ? "Partial completion" 
                          : "Completed today" 
                        : "Not completed today"}
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
