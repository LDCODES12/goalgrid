"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkInSchema } from "@/lib/validators"
import { getLocalDateKey, getWeekKey } from "@/lib/time"
import { computeDailyStreak, summarizeDailyCheckIns } from "@/lib/scoring"

/**
 * Undo the most recent check-in for a goal today
 * For single-target goals: removes the check-in
 * For multi-target goals: removes the most recent one (decrements count)
 */
export async function undoCheckInAction(goalId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) return { ok: false, error: "User not found." }

  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      ownerId: session.user.id,
    },
  })
  if (!goal) return { ok: false, error: "Goal not found or not yours." }

  const localDateKey = getLocalDateKey(new Date(), user.timezone)

  // Find today's check-ins, ordered by most recent first
  const todayCheckIns = await prisma.checkIn.findMany({
    where: {
      goalId: goal.id,
      userId: session.user.id,
      localDateKey,
    },
    orderBy: { timestamp: "desc" },
  })

  if (todayCheckIns.length === 0) {
    return { ok: false, error: "No check-ins to undo today." }
  }

  // Delete the most recent check-in
  await prisma.checkIn.delete({
    where: { id: todayCheckIns[0].id },
  })

  revalidatePath("/dashboard")
  revalidatePath("/group")
  revalidatePath("/goals")
  revalidatePath(`/goals/${goal.id}`)

  const newCount = todayCheckIns.length - 1
  return { 
    ok: true, 
    todayCount: newCount,
    dailyTarget: goal.dailyTarget ?? 1,
  }
}

export async function checkInGoalAction(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const parsed = checkInSchema.safeParse({
    goalId: formData.get("goalId"),
  })
  if (!parsed.success) return { ok: false, error: "Invalid goal." }

  // Check if this is a partial completion
  const isPartial = formData.get("isPartial") === "true"

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) return { ok: false, error: "User not found." }

  const goal = await prisma.goal.findFirst({
    where: {
      id: parsed.data.goalId,
      ownerId: session.user.id,  // Users can only check in to their own goals
    },
  })
  if (!goal) return { ok: false, error: "Goal not found or not yours." }

  const now = new Date()
  const localDateKey = getLocalDateKey(now, user.timezone)
  const weekKey = getWeekKey(now, user.timezone)

  // Count today's check-ins for this goal
  const todayCheckIns = await prisma.checkIn.findMany({
    where: {
      goalId: goal.id,
      userId: session.user.id,
      localDateKey,
    },
  })
  
  const dailyTarget = goal.dailyTarget ?? 1
  const todayCount = todayCheckIns.length
  
  // For single-target goals, use the old partial upgrade logic
  if (dailyTarget === 1) {
    const existing = todayCheckIns[0]
    if (existing) {
      if (existing.isPartial && !isPartial) {
        // Upgrade partial to full completion
        await prisma.checkIn.update({
          where: { id: existing.id },
          data: { isPartial: false, timestamp: now },
        })
        revalidatePath("/dashboard")
        revalidatePath("/group")
        revalidatePath("/goals")
        revalidatePath(`/goals/${goal.id}`)
        return { ok: true, upgraded: true }
      }
      return { ok: false, error: "Already completed today." }
    }
  } else {
    // For multi-target goals, check if we've hit the daily target
    if (todayCount >= dailyTarget) {
      return { ok: false, error: `Already completed ${dailyTarget}x today.` }
    }
  }

  await prisma.checkIn.create({
    data: {
      goalId: goal.id,
      userId: session.user.id,
      timestamp: now,
      localDateKey,
      weekKey,
      isPartial: dailyTarget === 1 ? isPartial : false, // Only support partial for single-target goals
    },
  })

  let streakMilestone: number | null = null
  if (goal.cadenceType === "DAILY") {
    const checkIns = await prisma.checkIn.findMany({
      where: {
        goalId: goal.id,
        userId: session.user.id,
      },
      select: { localDateKey: true },
    })
    const streak = computeDailyStreak(
      summarizeDailyCheckIns(checkIns),
      localDateKey,
      user.timezone,
      goal.dailyTarget ?? 1
    )
    if ([7, 14, 30].includes(streak)) {
      streakMilestone = streak
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/group")
  revalidatePath("/goals")
  revalidatePath(`/goals/${goal.id}`)
  
  // Return how many completions they now have today (for multi-target goals)
  const newCount = todayCount + 1
  return { 
    ok: true, 
    streakMilestone,
    todayCount: newCount,
    dailyTarget,
    isComplete: newCount >= dailyTarget,
  }
}
