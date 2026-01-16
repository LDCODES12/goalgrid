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

  await prisma.goal.create({
    data: {
      name: parsed.data.name,
      cadenceType: parsed.data.cadenceType,
      weeklyTarget:
        parsed.data.cadenceType === "WEEKLY"
          ? parsed.data.weeklyTarget ?? 1
          : null,
      notes: parsed.data.notes ?? null,
      owner: { connect: { id: session.user.id } },
      ...(membership?.groupId
        ? { group: { connect: { id: membership.groupId } } }
        : {}),
    },
  })

  revalidatePath("/goals")
  revalidatePath("/dashboard")
  return { ok: true }
}
