import { getServerSession } from "next-auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getLocalDateKey, getWeekKey } from "@/lib/time"
import {
  computeConsistencyPercentage,
  computeGracefulStreak,
  summarizeDailyCheckIns,
} from "@/lib/scoring"
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
        <h1 className="text-2xl font-bold tracking-tight">Your Goals</h1>
        <p className="text-sm text-muted-foreground">
          Build small wins every day. Weekly targets help you stay flexible.
        </p>
      </div>

      <GoalCreateForm />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active Goals</h2>
          <span className="text-sm text-muted-foreground">{goals.length} goal{goals.length !== 1 ? "s" : ""}</span>
        </div>
        
        {goals.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No goals yet. Create one above to start tracking.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {goals.map((goal) => {
              const checkIns = goal.checkIns.filter(
                (check) => check.userId === user.id
              )
              const dailyTarget = goal.dailyTarget ?? 1
              const todayCheckIns = checkIns.filter(
                (check) => check.localDateKey === todayKey
              )
              const todayCount = todayCheckIns.length
              const todayDone = todayCount >= dailyTarget
              const todayPartial = todayCheckIns.length > 0 && todayCheckIns[0]?.isPartial && dailyTarget === 1
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
                goal.streakFreezes,
                dailyTarget
              )
              const consistency = computeConsistencyPercentage(
                dateKeys,
                todayKey,
                user.timezone,
                30,
                goal.createdAt,
                dailyTarget
              )

              return (
                <div
                  key={goal.id}
                  className={`group rounded-xl border bg-card p-5 transition-all hover:shadow-md ${
                    todayDone && !todayPartial ? "border-emerald-500/30 bg-emerald-500/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            todayDone 
                              ? todayPartial 
                                ? "bg-amber-500" 
                                : "bg-emerald-500" 
                              : "border-2 border-muted-foreground/30"
                          }`}
                        />
                        <Link
                          href={`/goals/${goal.id}`}
                          className="font-semibold truncate hover:underline"
                        >
                          {goal.name}
                        </Link>
                        <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                          {consistency}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {goal.cadenceType === "DAILY"
                            ? "Daily"
                            : `${goal.weeklyTarget}x/week`}
                        </span>
                        <span>•</span>
                        <span>{gracefulStreak.currentStreak}d streak</span>
                        {gracefulStreak.isAtRisk && (
                          <span className="text-amber-500">• At risk</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>This week</span>
                      <span className="font-medium">{weekCheckIns.length}/{weekTarget}</span>
                    </div>
                    <Progress value={weekProgress} className="h-1.5" />
                  </div>

                  <div className="mt-4">
                    <CheckInButton
                      goalId={goal.id}
                      completed={todayDone}
                      todayCount={todayCount}
                      dailyTarget={dailyTarget}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
