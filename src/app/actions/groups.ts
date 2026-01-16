"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createGroupSchema, joinGroupSchema } from "@/lib/validators"
import { generateInviteCode } from "@/lib/invite"

export async function createGroupAction(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
  })
  if (!parsed.success) return { ok: false, error: "Invalid group name" }

  const existingMembership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id },
  })
  if (existingMembership) {
    return { ok: false, error: "You are already in a group." }
  }

  let inviteCode = generateInviteCode()
  let tries = 0
  while (tries < 5) {
    const exists = await prisma.group.findUnique({ where: { inviteCode } })
    if (!exists) break
    inviteCode = generateInviteCode()
    tries += 1
  }

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      inviteCode,
      members: {
        create: { userId: session.user.id, role: "ADMIN" },
      },
    },
  })

  await prisma.goal.updateMany({
    where: { ownerId: session.user.id, groupId: null },
    data: { groupId: group.id },
  })

  revalidatePath("/group")
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function joinGroupAction(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const parsed = joinGroupSchema.safeParse({
    inviteCode: formData.get("inviteCode"),
  })
  if (!parsed.success) return { ok: false, error: "Invalid invite code" }

  const existingMembership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id },
  })
  if (existingMembership) {
    return { ok: false, error: "You are already in a group." }
  }

  const group = await prisma.group.findUnique({
    where: { inviteCode: parsed.data.inviteCode.toUpperCase() },
  })
  if (!group) return { ok: false, error: "Invite code not found." }

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.create({
      data: {
        userId: session.user.id,
        groupId: group.id,
        role: "MEMBER",
      },
    })
    await tx.goal.updateMany({
      where: { ownerId: session.user.id, groupId: null },
      data: { groupId: group.id },
    })
  })

  revalidatePath("/group")
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function joinGroupByCodeAction(inviteCode: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const parsed = joinGroupSchema.safeParse({ inviteCode })
  if (!parsed.success) return { ok: false, error: "Invalid invite code" }

  const existingMembership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id },
  })
  if (existingMembership) {
    return { ok: false, error: "You are already in a group." }
  }

  const group = await prisma.group.findUnique({
    where: { inviteCode: parsed.data.inviteCode.toUpperCase() },
  })
  if (!group) return { ok: false, error: "Invite code not found." }

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.create({
      data: {
        userId: session.user.id,
        groupId: group.id,
        role: "MEMBER",
      },
    })
    await tx.goal.updateMany({
      where: { ownerId: session.user.id, groupId: null },
      data: { groupId: group.id },
    })
  })

  revalidatePath("/group")
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function leaveGroupAction() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const membership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id },
  })
  if (!membership) return { ok: false, error: "Not in a group." }

  const remainingMembers = await prisma.groupMember.count({
    where: { groupId: membership.groupId },
  })

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.delete({ where: { id: membership.id } })
    if (remainingMembers <= 1) {
      await tx.group.delete({ where: { id: membership.groupId } })
    }
  })

  revalidatePath("/group")
  revalidatePath("/dashboard")
  return { ok: true }
}
