"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { addDays, startOfWeek } from "date-fns"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getWeekKey } from "@/lib/time"

type ChallengeMode = "STANDARD" | "TEAM_VS_TEAM" | "DUO_COMPETITION"

interface CreateChallengeOptions {
  groupId: string
  mode?: ChallengeMode
  durationDays?: number
  threshold?: number
}

/**
 * Get the week key for the next ISO week (starts Monday)
 */
function getNextWeekKey(timezone: string): string {
  const now = new Date()
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
  const nextWeekStart = addDays(currentWeekStart, 7)
  return getWeekKey(nextWeekStart, timezone)
}

/**
 * Shuffle array using Fisher-Yates algorithm for fair team/duo assignment
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Assign members to two teams for TEAM_VS_TEAM mode
 */
function assignTeams(memberIds: string[]): { team1: string[]; team2: string[] } {
  const shuffled = shuffleArray(memberIds)
  const midpoint = Math.ceil(shuffled.length / 2)
  return {
    team1: shuffled.slice(0, midpoint),
    team2: shuffled.slice(midpoint),
  }
}

/**
 * Assign members to duos for DUO_COMPETITION mode
 * If odd number, one person gets a "solo" status
 */
function assignDuos(memberIds: string[]): string[][] {
  const shuffled = shuffleArray(memberIds)
  const duos: string[][] = []

  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      duos.push([shuffled[i], shuffled[i + 1]])
    } else {
      // Odd person out - create solo duo
      duos.push([shuffled[i]])
    }
  }

  return duos
}

/**
 * Create a new challenge for the group.
 * The challenge will run during the next ISO week.
 * Creator automatically approves.
 */
export async function createChallengeAction(groupId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const membership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id, groupId },
  })
  if (!membership) return { ok: false, error: "Not a member of this group" }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  })
  const timezone = user?.timezone ?? "America/Chicago"

  const nextWeekKey = getNextWeekKey(timezone)

  // Check if a challenge already exists for next week
  const existing = await prisma.groupChallenge.findUnique({
    where: { groupId_weekKey: { groupId, weekKey: nextWeekKey } },
  })
  if (existing) {
    return { ok: false, error: "A challenge already exists for next week" }
  }

  // Calculate start and end dates for the challenge
  const now = new Date()
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const nextWeekStart = addDays(currentWeekStart, 7)
  const challengeEnd = addDays(nextWeekStart, 7) // Default 7 days duration

  // Create the challenge and auto-approve for the creator
  const challenge = await prisma.groupChallenge.create({
    data: {
      groupId,
      weekKey: nextWeekKey,
      createdById: session.user.id,
      status: "PENDING",
      threshold: 90,
      mode: "STANDARD",
      durationDays: 7,
      startDate: nextWeekStart,
      endDate: challengeEnd,
      approvals: {
        create: {
          userId: session.user.id,
        },
      },
    },
    include: { approvals: true },
  })

  // Check if all members have now approved
  const memberCount = await prisma.groupMember.count({ where: { groupId } })
  if (challenge.approvals.length >= memberCount) {
    await prisma.groupChallenge.update({
      where: { id: challenge.id },
      data: { status: "SCHEDULED" },
    })
  }

  revalidatePath("/group")
  return { ok: true, challenge }
}

/**
 * Create a new challenge with advanced configuration options.
 * Supports different modes: STANDARD, TEAM_VS_TEAM, DUO_COMPETITION
 * Only group ADMINs (leaders) can create challenges.
 */
export async function createChallengeV2Action(options: CreateChallengeOptions) {
  const { groupId, mode = "STANDARD", durationDays = 7, threshold = 90 } = options

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  // Check if user is an ADMIN (group leader)
  const membership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id, groupId },
  })
  if (!membership) return { ok: false, error: "Not a member of this group" }
  if (membership.role !== "ADMIN") {
    return { ok: false, error: "Only group leaders can create challenges" }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  })
  const timezone = user?.timezone ?? "America/Chicago"

  const nextWeekKey = getNextWeekKey(timezone)

  // Check if a challenge already exists for next week
  const existing = await prisma.groupChallenge.findUnique({
    where: { groupId_weekKey: { groupId, weekKey: nextWeekKey } },
  })
  if (existing) {
    return { ok: false, error: "A challenge already exists for next week" }
  }

  // Get all group members for team/duo assignment
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  })

  if (members.length < 2) {
    return { ok: false, error: "Need at least 2 members for a challenge" }
  }

  const memberIds = members.map((m) => m.userId)

  // Calculate start and end dates
  const now = new Date()
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const nextWeekStart = addDays(currentWeekStart, 7)
  const challengeEnd = addDays(nextWeekStart, durationDays)

  // Assign teams/duos based on mode
  let teamAssignments = null
  let duoAssignments = null

  if (mode === "TEAM_VS_TEAM") {
    teamAssignments = assignTeams(memberIds)
  } else if (mode === "DUO_COMPETITION") {
    duoAssignments = assignDuos(memberIds)
  }

  // Create the challenge with advanced configuration
  const challenge = await prisma.groupChallenge.create({
    data: {
      groupId,
      weekKey: nextWeekKey,
      createdById: session.user.id,
      status: "PENDING",
      threshold,
      mode,
      durationDays,
      startDate: nextWeekStart,
      endDate: challengeEnd,
      teamAssignments: teamAssignments ? (teamAssignments as any) : undefined,
      duoAssignments: duoAssignments ? (duoAssignments as any) : undefined,
      approvals: {
        create: {
          userId: session.user.id,
        },
      },
    },
    include: { approvals: true },
  })

  // Check if all members have now approved (unlikely for just creator)
  const memberCount = members.length
  if (challenge.approvals.length >= memberCount) {
    await prisma.groupChallenge.update({
      where: { id: challenge.id },
      data: { status: "SCHEDULED" },
    })
  }

  revalidatePath("/group")
  return {
    ok: true,
    challenge: {
      ...challenge,
      teamAssignments,
      duoAssignments,
    },
  }
}

/**
 * Approve/join a pending challenge.
 */
export async function approveChallengeAction(challengeId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const challenge = await prisma.groupChallenge.findUnique({
    where: { id: challengeId },
    include: { group: { include: { members: true } }, approvals: true },
  })
  if (!challenge) return { ok: false, error: "Challenge not found" }

  // Check if user is a member of the group
  const isMember = challenge.group.members.some((m) => m.userId === session.user.id)
  if (!isMember) return { ok: false, error: "Not a member of this group" }

  if (challenge.status !== "PENDING") {
    return { ok: false, error: "Challenge is not pending approval" }
  }

  // Check if already approved
  const alreadyApproved = challenge.approvals.some((a) => a.userId === session.user.id)
  if (alreadyApproved) {
    return { ok: false, error: "Already approved this challenge" }
  }

  // Use transaction to avoid race conditions when multiple users approve simultaneously
  await prisma.$transaction(async (tx) => {
    // Create approval
    await tx.challengeApproval.create({
      data: {
        challengeId,
        userId: session.user.id,
      },
    })

    // Count approvals AFTER creating (atomic within transaction)
    const approvalCount = await tx.challengeApproval.count({
      where: { challengeId },
    })
    
    const memberCount = await tx.groupMember.count({
      where: { groupId: challenge.groupId },
    })

    // If all members have approved, transition to SCHEDULED
    if (approvalCount >= memberCount) {
      await tx.groupChallenge.update({
        where: { id: challengeId },
        data: { status: "SCHEDULED" },
      })
    }
  })

  revalidatePath("/group")
  return { ok: true }
}

/**
 * Evaluate and update challenge statuses.
 * Should be called on page load to transition:
 * - SCHEDULED -> ACTIVE when the challenge week starts
 * - ACTIVE -> SUCCEEDED/FAILED when the challenge week ends
 */
export async function evaluateChallengesAction(groupId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  })
  const timezone = user?.timezone ?? "America/Chicago"

  const currentWeekKey = getWeekKey(new Date(), timezone)

  // Get all challenges for this group that might need status updates
  const challenges = await prisma.groupChallenge.findMany({
    where: {
      groupId,
      status: { in: ["SCHEDULED", "ACTIVE"] },
    },
    include: {
      group: { include: { members: { include: { user: true } } } },
    },
  })

  for (const challenge of challenges) {
    // SCHEDULED -> ACTIVE: If current week matches challenge week
    if (challenge.status === "SCHEDULED" && challenge.weekKey === currentWeekKey) {
      await prisma.groupChallenge.update({
        where: { id: challenge.id },
        data: { status: "ACTIVE" },
      })
    }

    // ACTIVE -> SUCCEEDED/FAILED: If challenge week is in the past
    if (challenge.status === "ACTIVE" && challenge.weekKey < currentWeekKey) {
      // Calculate completion for each member
      const memberCompletions = await calculateMemberCompletions(
        challenge.group.members.map((m) => m.userId),
        groupId,
        challenge.weekKey
      )

      // Check if all members met the threshold
      const allPassed = memberCompletions.every((m) => m.completionPercent >= challenge.threshold)

      if (allPassed) {
        // All passed - rank up the group
        await prisma.$transaction([
          prisma.groupChallenge.update({
            where: { id: challenge.id },
            data: { status: "SUCCEEDED" },
          }),
          prisma.group.update({
            where: { id: groupId },
            data: { rank: { increment: 1 } },
          }),
        ])
      } else {
        // Someone failed
        await prisma.groupChallenge.update({
          where: { id: challenge.id },
          data: { status: "FAILED" },
        })
      }
    }
  }

  revalidatePath("/group")
  return { ok: true }
}

/**
 * Calculate completion percentage for members during a specific week.
 */
async function calculateMemberCompletions(
  userIds: string[],
  groupId: string,
  weekKey: string
): Promise<{ userId: string; completionPercent: number }[]> {
  const results: { userId: string; completionPercent: number }[] = []

  for (const userId of userIds) {
    // Get ALL active goals for this user (not just group goals)
    // This measures their overall commitment during the challenge week
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
      // No goals at all = 0% (member needs to set up goals to participate)
      results.push({ userId, completionPercent: 0 })
      continue
    }

    // Get check-ins for this week
    const checkIns = await prisma.checkIn.findMany({
      where: {
        userId,
        weekKey,
        goalId: { in: goals.map((g) => g.id) },
      },
      select: { goalId: true, localDateKey: true },
    })

    // Calculate total target and completed for the week
    let totalTarget = 0
    let totalCompleted = 0

    for (const goal of goals) {
      const goalCheckIns = checkIns.filter((c) => c.goalId === goal.id)
      
      if (goal.cadenceType === "WEEKLY") {
        const target = goal.weeklyTarget ?? 1
        totalTarget += target
        totalCompleted += Math.min(goalCheckIns.length, target)
      } else {
        // Daily goal: target is dailyTarget * 7
        const dailyTarget = goal.dailyTarget ?? 1
        const weekTarget = dailyTarget * 7
        totalTarget += weekTarget
        totalCompleted += Math.min(goalCheckIns.length, weekTarget)
      }
    }

    const completionPercent = totalTarget > 0 
      ? Math.round((totalCompleted / totalTarget) * 100)
      : 100

    results.push({ userId, completionPercent })
  }

  return results
}

/**
 * Get the current/pending challenge for a group.
 */
export async function getGroupChallengeAction(groupId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  // Evaluate any pending status transitions first
  await evaluateChallengesAction(groupId)

  // Get challenges (active, scheduled, or pending for current/next week)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  })
  const timezone = user?.timezone ?? "America/Chicago"

  const currentWeekKey = getWeekKey(new Date(), timezone)
  const nextWeekKey = getNextWeekKey(timezone)

  const challenges = await prisma.groupChallenge.findMany({
    where: {
      groupId,
      OR: [
        { weekKey: currentWeekKey },
        { weekKey: nextWeekKey },
        { status: { in: ["PENDING", "SCHEDULED", "ACTIVE"] } },
      ],
    },
    include: {
      approvals: { select: { userId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  })

  const challenge = challenges[0] ?? null
  const hasApproved = challenge?.approvals.some((a) => a.userId === session.user.id) ?? false

  // Get group member count
  const memberCount = await prisma.groupMember.count({ where: { groupId } })

  // Get group rank
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { rank: true },
  })

  return {
    ok: true,
    challenge: challenge
      ? {
          id: challenge.id,
          weekKey: challenge.weekKey,
          status: challenge.status,
          threshold: challenge.threshold,
          approvalCount: challenge.approvals.length,
          memberCount,
          hasApproved,
          isCurrentWeek: challenge.weekKey === currentWeekKey,
          isNextWeek: challenge.weekKey === nextWeekKey,
        }
      : null,
    groupRank: group?.rank ?? 1,
    currentWeekKey,
  }
}

/**
 * Get challenge results for a completed challenge.
 */
export async function getChallengeResultsAction(challengeId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" }

  const challenge = await prisma.groupChallenge.findUnique({
    where: { id: challengeId },
    include: {
      group: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, nickname: true } } },
          },
        },
      },
    },
  })

  if (!challenge) return { ok: false, error: "Challenge not found" }

  if (!["SUCCEEDED", "FAILED"].includes(challenge.status)) {
    return { ok: false, error: "Challenge is not complete" }
  }

  // Get member completion percentages
  const memberCompletions = await calculateMemberCompletions(
    challenge.group.members.map((m) => m.userId),
    challenge.groupId,
    challenge.weekKey
  )

  const results = challenge.group.members.map((m) => {
    const completion = memberCompletions.find((c) => c.userId === m.userId)
    return {
      userId: m.userId,
      name: m.user.nickname ?? m.user.name,
      completionPercent: completion?.completionPercent ?? 0,
      passed: (completion?.completionPercent ?? 0) >= challenge.threshold,
    }
  })

  return {
    ok: true,
    results,
    threshold: challenge.threshold,
    succeeded: challenge.status === "SUCCEEDED",
  }
}
