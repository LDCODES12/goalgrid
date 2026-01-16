"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createGoalSchema } from "@/lib/validators"

export async function createGoalAction(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const parsed = createGoalSchema.safeParse({
    name: formData.get("name"),
    cadenceType: formData.get("cadenceType"),
    weeklyTarget: formData.get("weeklyTarget"),
    dailyTarget: formData.get("dailyTarget"),
    notes: formData.get("notes"),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message }
  }

  if (parsed.data.cadenceType === "WEEKLY" && !parsed.data.weeklyTarget) {
    return { ok: false, error: "Weekly goals need a target." }
  }

  const membership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id },
  })

  const goal = await prisma.goal.create({
    data: {
      name: parsed.data.name,
      cadenceType: parsed.data.cadenceType,
      weeklyTarget:
        parsed.data.cadenceType === "WEEKLY"
          ? parsed.data.weeklyTarget ?? 1
          : null,
      dailyTarget: parsed.data.dailyTarget ?? 1,
      notes: parsed.data.notes ?? null,
      owner: { connect: { id: session.user.id } },
      ...(membership?.groupId
        ? { group: { connect: { id: membership.groupId } } }
        : {}),
    },
  })

  revalidatePath("/goals")
  revalidatePath("/dashboard")
  return { ok: true, goalId: goal.id }
}

export async function deleteGoalAction(goalId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  // Verify the user owns the goal
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
  })
  
  if (!goal) {
    return { ok: false, error: "Goal not found." }
  }
  
  if (goal.ownerId !== session.user.id) {
    return { ok: false, error: "Not authorized to delete this goal." }
  }

  // Delete the goal (check-ins will cascade delete due to schema)
  await prisma.goal.delete({
    where: { id: goalId },
  })

  // Revalidate all paths that might show this goal
  revalidatePath("/goals")
  revalidatePath(`/goals/${goalId}`)
  revalidatePath("/dashboard")
  revalidatePath("/group")
  return { ok: true }
}

export async function archiveGoalAction(goalId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
  })
  
  if (!goal || goal.ownerId !== session.user.id) {
    return { ok: false, error: "Goal not found." }
  }

  await prisma.goal.update({
    where: { id: goalId },
    data: { active: false },
  })

  revalidatePath("/goals")
  revalidatePath("/dashboard")
  return { ok: true }
}
