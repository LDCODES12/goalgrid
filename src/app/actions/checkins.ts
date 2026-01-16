"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkInSchema } from "@/lib/validators"
import { getLocalDateKey, getWeekKey } from "@/lib/time"
import { computeDailyStreak, summarizeDailyCheckIns } from "@/lib/scoring"

export async function checkInGoalAction(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const parsed = checkInSchema.safeParse({
    goalId: formData.get("goalId"),
  })
  if (!parsed.success) return { ok: false, error: "Invalid goal." }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) return { ok: false, error: "User not found." }

  const goal = await prisma.goal.findFirst({
    where: {
      id: parsed.data.goalId,
      OR: [
        { ownerId: session.user.id },
        {
          group: {
            members: {
              some: { userId: session.user.id },
            },
          },
        },
      ],
    },
  })
  if (!goal) return { ok: false, error: "Goal not found." }

  const now = new Date()
  const localDateKey = getLocalDateKey(now, user.timezone)
  const weekKey = getWeekKey(now, user.timezone)

  const existing = await prisma.checkIn.findFirst({
    where: {
      goalId: goal.id,
      userId: session.user.id,
      localDateKey,
    },
  })
  if (existing) {
    return { ok: false, error: "Already completed today." }
  }

  await prisma.checkIn.create({
    data: {
      goalId: goal.id,
      userId: session.user.id,
      timestamp: now,
      localDateKey,
      weekKey,
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
      localDateKey
    )
    if ([7, 14, 30].includes(streak)) {
      streakMilestone = streak
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/group")
  revalidatePath("/goals")
  revalidatePath(`/goals/${goal.id}`)
  return { ok: true, streakMilestone }
}
