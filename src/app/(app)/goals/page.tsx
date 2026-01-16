import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getLocalDateKey, getWeekKey } from "@/lib/time"
import {
  computeConsistencyPercentage,
  computeGracefulStreak,
  summarizeDailyCheckIns,
} from "@/lib/scoring"
import { GoalCreateForm } from "@/components/goal-create-form"
import { DraggableGoalsGrid } from "@/components/draggable-goals-grid"

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
    orderBy: { sortOrder: "asc" },
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
        
        <DraggableGoalsGrid 
          goals={goals.map((goal) => {
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
            // For daily goals: weekTarget = dailyTarget * 7 (e.g., 3x/day = 21/week)
            const weekTarget = isWeekly ? weeklyTarget : dailyTarget * 7
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

            return {
              goal: {
                id: goal.id,
                name: goal.name,
                cadenceType: goal.cadenceType,
                weeklyTarget: goal.weeklyTarget,
              },
              todayDone,
              todayPartial,
              todayCount,
              dailyTarget,
              weekCheckIns: weekCheckIns.length,
              weekTarget,
              weekProgress,
              consistency,
              gracefulStreak: {
                currentStreak: gracefulStreak.currentStreak,
                isAtRisk: gracefulStreak.isAtRisk,
              },
            }
          })}
        />
      </div>
    </div>
  )
}
