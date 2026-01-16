"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { parseISO, startOfDay, isBefore, isAfter, addHours } from "date-fns"
import { toZonedTime } from "date-fns-tz"
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

/**
 * Log check-in(s) for a specific past date
 * Sets the completion count for that date (replaces existing)
 */
export async function logHistoricalCheckInAction({
  goalId,
  date,
  count,
}: {
  goalId: string
  date: string // YYYY-MM-DD format
  count: number
}) {
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

  // Validate date format
  const targetDate = parseISO(date)
  if (isNaN(targetDate.getTime())) {
    return { ok: false, error: "Invalid date format." }
  }

  // Get today's date in user's timezone
  const todayKey = getLocalDateKey(new Date(), user.timezone)
  
  // Validate: date must be before today
  if (date >= todayKey) {
    return { ok: false, error: "Can only log activity for past dates." }
  }

  // Validate: date must be on or after goal creation
  const goalCreatedKey = getLocalDateKey(goal.createdAt, user.timezone)
  if (date < goalCreatedKey) {
    return { ok: false, error: "Cannot log activity before the goal was created." }
  }

  // Validate count
  const dailyTarget = goal.dailyTarget ?? 1
  if (count < 0 || count > dailyTarget) {
    return { ok: false, error: `Count must be between 0 and ${dailyTarget}.` }
  }

  // Get the week key for the target date
  const weekKey = getWeekKey(targetDate, user.timezone)

  // Create a timestamp at noon on the target date (avoids timezone edge cases)
  const timestamp = addHours(startOfDay(targetDate), 12)

  // Get existing check-ins for this date
  const existingCheckIns = await prisma.checkIn.findMany({
    where: {
      goalId: goal.id,
      userId: session.user.id,
      localDateKey: date,
    },
  })

  const existingCount = existingCheckIns.length

  // Use a transaction to update the check-ins
  await prisma.$transaction(async (tx) => {
    if (count > existingCount) {
      // Need to add more check-ins
      const toAdd = count - existingCount
      const newCheckIns = Array.from({ length: toAdd }).map(() => ({
        goalId: goal.id,
        userId: session.user.id,
        timestamp,
        localDateKey: date,
        weekKey,
        isPartial: false,
      }))
      await tx.checkIn.createMany({ data: newCheckIns })
    } else if (count < existingCount) {
      // Need to remove check-ins
      const toRemove = existingCount - count
      const idsToDelete = existingCheckIns.slice(0, toRemove).map((c) => c.id)
      await tx.checkIn.deleteMany({
        where: { id: { in: idsToDelete } },
      })
    }
    // If count === existingCount, nothing to do
  })

  revalidatePath("/dashboard")
  revalidatePath("/group")
  revalidatePath("/goals")
  revalidatePath(`/goals/${goal.id}`)

  return { ok: true, count }
}

/**
 * Get check-ins for a specific date
 */
export async function getHistoricalCheckInsAction({
  goalId,
  date,
}: {
  goalId: string
  date: string // YYYY-MM-DD format
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      ownerId: session.user.id,
    },
  })
  if (!goal) return { ok: false, error: "Goal not found or not yours." }

  const checkIns = await prisma.checkIn.findMany({
    where: {
      goalId: goal.id,
      userId: session.user.id,
      localDateKey: date,
    },
    orderBy: { timestamp: "asc" },
  })

  return {
    ok: true,
    count: checkIns.length,
    dailyTarget: goal.dailyTarget ?? 1,
    checkIns: checkIns.map((c) => ({
      id: c.id,
      timestamp: c.timestamp.toISOString(),
      isPartial: c.isPartial,
    })),
  }
}

/**
 * Delete a specific historical check-in
 */
export async function deleteHistoricalCheckInAction({
  checkInId,
}: {
  checkInId: string
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const checkIn = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    include: { goal: true },
  })

  if (!checkIn) {
    return { ok: false, error: "Check-in not found." }
  }

  if (checkIn.goal.ownerId !== session.user.id) {
    return { ok: false, error: "Not authorized to delete this check-in." }
  }

  await prisma.checkIn.delete({
    where: { id: checkInId },
  })

  revalidatePath("/dashboard")
  revalidatePath("/group")
  revalidatePath("/goals")
  revalidatePath(`/goals/${checkIn.goalId}`)

  return { ok: true }
}
