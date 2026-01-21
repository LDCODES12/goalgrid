"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getWeekKey } from "@/lib/time"
import { calculateTierFromCompletionRate, wasTierUpgraded, type TierName } from "@/lib/tiers"

/**
 * Calculate weekly group completion rate
 * This looks at all active goals for all group members during the current week
 */
async function calculateGroupCompletionRate(
  groupId: string,
  weekKey: string
): Promise<number> {
  // Get all group members
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  })

  if (members.length === 0) {
    return 0
  }

  const userIds = members.map((m) => m.userId)
  let totalCompleted = 0
  let totalTarget = 0

  // Calculate completion for each member
  for (const userId of userIds) {
    // Get ALL active goals for this user
    const goals = await prisma.goal.findMany({
      where: { ownerId: userId, active: true },
      select: {
        id: true,
        cadenceType: true,
        dailyTarget: true,
        weeklyTarget: true,
      },
    })

    if (goals.length === 0) {
      // Member has no goals - counts as 0 contribution
      continue
    }

    // Get check-ins for this week
    const checkIns = await prisma.checkIn.findMany({
      where: {
        userId,
        weekKey,
        goalId: { in: goals.map((g) => g.id) },
      },
      select: { goalId: true },
    })

    // Calculate completed and target for this member
    for (const goal of goals) {
      const checkInCount = checkIns.filter((c) => c.goalId === goal.id).length

      if (goal.cadenceType === "DAILY") {
        const weeklyTarget = goal.dailyTarget * 7
        totalTarget += weeklyTarget
        totalCompleted += Math.min(checkInCount, weeklyTarget)
      } else {
        // WEEKLY
        const weeklyTarget = goal.weeklyTarget || 1
        totalTarget += weeklyTarget
        totalCompleted += Math.min(checkInCount, weeklyTarget)
      }
    }
  }

  if (totalTarget === 0) {
    return 0
  }

  return (totalCompleted / totalTarget) * 100
}

/**
 * Update group tier based on current week's completion rate
 * This should be called periodically (e.g., end of week, or on-demand)
 */
export async function updateGroupTierAction(groupId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  // Verify user is a member of the group
  const membership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id, groupId },
  })
  if (!membership) return { ok: false, error: "Not a member of this group" }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  })
  const timezone = user?.timezone ?? "America/Chicago"

  const currentWeekKey = getWeekKey(new Date(), timezone)

  // Calculate current week's completion rate
  const completionRate = await calculateGroupCompletionRate(groupId, currentWeekKey)

  // Determine new tier based on completion rate
  const newTierInfo = calculateTierFromCompletionRate(completionRate)

  // Get current group data
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { currentTier: true },
  })

  if (!group) return { ok: false, error: "Group not found" }

  const oldTier = group.currentTier as TierName
  const upgraded = wasTierUpgraded(oldTier, newTierInfo.name)

  // Update group with new tier and completion rate
  await prisma.group.update({
    where: { id: groupId },
    data: {
      currentTier: newTierInfo.name,
      weeklyCompletionRate: completionRate,
      lastTierUpdate: new Date(),
    },
  })

  revalidatePath("/group")

  return {
    ok: true,
    oldTier,
    newTier: newTierInfo.name,
    completionRate,
    upgraded,
  }
}

/**
 * Get current group tier information
 */
export async function getGroupTierAction(groupId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  // Verify user is a member of the group
  const membership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id, groupId },
  })
  if (!membership) return { ok: false, error: "Not a member of this group" }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      currentTier: true,
      weeklyCompletionRate: true,
      lastTierUpdate: true,
    },
  })

  if (!group) return { ok: false, error: "Group not found" }

  return {
    ok: true,
    currentTier: group.currentTier,
    weeklyCompletionRate: group.weeklyCompletionRate,
    lastTierUpdate: group.lastTierUpdate,
  }
}
