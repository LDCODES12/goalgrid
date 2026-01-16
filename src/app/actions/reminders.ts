"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { subHours } from "date-fns"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function sendReminderAction({
  recipientId,
}: {
  recipientId: string
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  if (recipientId === session.user.id) {
    return { ok: false, error: "You can’t remind yourself." }
  }

  const membership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id },
  })
  if (!membership) return { ok: false, error: "Join a group first." }

  const recipientMembership = await prisma.groupMember.findFirst({
    where: { userId: recipientId, groupId: membership.groupId },
  })
  if (!recipientMembership) return { ok: false, error: "User not in your group." }

  // Rate limit: max 1 reminder per recipient per 24 hours
  const recentReminder = await prisma.reminder.findFirst({
    where: {
      senderId: session.user.id,
      recipientId,
      createdAt: { gte: subHours(new Date(), 24) },
    },
  })
  if (recentReminder) {
    return { ok: false, error: "Already sent a reminder in the last 24 hours." }
  }

  await prisma.reminder.create({
    data: {
      groupId: membership.groupId,
      senderId: session.user.id,
      recipientId,
      message: "Friendly reminder to complete today’s goals.",
    },
  })

  revalidatePath("/group")
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function dismissReminderAction(reminderId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  await prisma.reminder.updateMany({
    where: { id: reminderId, recipientId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  })

  revalidatePath("/dashboard")
  return { ok: true }
}
