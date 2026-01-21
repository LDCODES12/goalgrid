"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format, addDays } from "date-fns"
import { Shield, Trophy, Users, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  approveChallengeAction,
  getGroupChallengeAction,
  deleteChallengeAction,
} from "@/app/actions/challenges"
import { getRankName } from "@/lib/ranks"
import { toast } from "sonner"
import { CreateChallengeDialog } from "./create-challenge-dialog"

// Rank colors
const RANK_CONFIG: Record<number, { color: string; bgColor: string; borderColor: string }> = {
  1: { color: "text-amber-700 dark:text-amber-500", bgColor: "bg-amber-100 dark:bg-amber-900/30", borderColor: "border-amber-300 dark:border-amber-700" },
  2: { color: "text-slate-500", bgColor: "bg-slate-100 dark:bg-slate-800/50", borderColor: "border-slate-300 dark:border-slate-600" },
  3: { color: "text-yellow-600 dark:text-yellow-500", bgColor: "bg-yellow-100 dark:bg-yellow-900/30", borderColor: "border-yellow-300 dark:border-yellow-700" },
  4: { color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-100 dark:bg-cyan-900/30", borderColor: "border-cyan-300 dark:border-cyan-700" },
  5: { color: "text-violet-600 dark:text-violet-400", bgColor: "bg-violet-100 dark:bg-violet-900/30", borderColor: "border-violet-300 dark:border-violet-700" },
}

function getRankConfig(rank: number) {
  if (rank >= 5) return RANK_CONFIG[5]
  return RANK_CONFIG[rank] ?? RANK_CONFIG[1]
}

/**
 * Rank Badge - Compact rank display
 */
export function RankBadge({ rank, size = "default" }: { rank: number; size?: "sm" | "default" | "lg" }) {
  const config = getRankConfig(rank)
  const rankName = getRankName(rank)
  
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    default: "px-2.5 py-0.5 text-xs gap-1",
    lg: "px-3 py-1 text-sm gap-1.5",
  }
  
  const iconSizes = { sm: 10, default: 12, lg: 14 }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.bgColor,
        config.borderColor,
        config.color,
        sizeClasses[size]
      )}
    >
      <Shield className="shrink-0" style={{ width: iconSizes[size], height: iconSizes[size] }} />
      <span>{rankName}</span>
    </div>
  )
}

/**
 * Challenge Card - Compact inline challenge component
 */
export function ChallengeCard({ groupId, userRole }: { groupId: string; userRole?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [challenge, setChallenge] = useState<{
    id: string
    weekKey: string
    status: string
    threshold: number
    approvalCount: number
    memberCount: number
    hasApproved: boolean
    isCurrentWeek: boolean
    isNextWeek: boolean
  } | null>(null)
  const [groupRank, setGroupRank] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await getGroupChallengeAction(groupId)
      if (result.ok) {
        setChallenge(result.challenge ?? null)
        setGroupRank(result.groupRank ?? 1)
      }
      setLoading(false)
    }
    load()
  }, [groupId])


  const handleApprove = () => {
    if (!challenge) return
    startTransition(async () => {
      const result = await approveChallengeAction(challenge.id)
      if (result.ok) {
        toast.success("You're in!")
        router.refresh()
        const newData = await getGroupChallengeAction(groupId)
        if (newData.ok) {
          setChallenge(newData.challenge ?? null)
          setGroupRank(newData.groupRank ?? 1)
        }
      } else {
        toast.error(result.error ?? "Failed to join")
      }
    })
  }

  // Parse week key to get date range
  const getWeekDateRange = (weekKey: string) => {
    const [yearStr, weekNumStr] = weekKey.split("-W")
    const year = parseInt(yearStr)
    const weekNum = parseInt(weekNumStr)
    const jan4 = new Date(year, 0, 4)
    const jan4Day = jan4.getDay() || 7
    const week1Monday = new Date(jan4)
    week1Monday.setDate(jan4.getDate() - (jan4Day - 1))
    const weekStart = addDays(week1Monday, (weekNum - 1) * 7)
    const weekEnd = addDays(weekStart, 6)
    return { start: weekStart, end: weekEnd }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // No active challenge - show compact proposal option
  if (!challenge) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Weekly Challenge</div>
              <div className="text-xs text-muted-foreground">
                All members hit 90% → rank up to {getRankName(groupRank + 1)}
              </div>
            </div>
          </div>
          <CreateChallengeDialog
            groupId={groupId}
            isLeader={userRole === "ADMIN"}
            onChallengeCreated={async () => {
              const newData = await getGroupChallengeAction(groupId)
              if (newData.ok) {
                setChallenge(newData.challenge ?? null)
                setGroupRank(newData.groupRank ?? 1)
              }
            }}
          />
        </div>
      </div>
    )
  }

  const weekRange = getWeekDateRange(challenge.weekKey)
  const approvalProgress = (challenge.approvalCount / challenge.memberCount) * 100

  // Challenge is pending approval - show voting UI
  if (challenge.status === "PENDING") {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-amber-600" />
            <div>
              <div className="text-sm font-medium">
                Challenge proposed for {format(weekRange.start, "MMM d")} - {format(weekRange.end, "d")}
              </div>
              <div className="text-xs text-muted-foreground">
                {challenge.approvalCount}/{challenge.memberCount} members ready
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {challenge.hasApproved ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <Check className="h-3.5 w-3.5" />
                Joined
              </div>
            ) : (
              <Button onClick={handleApprove} disabled={isPending} size="sm" variant="default">
                Join
              </Button>
            )}
            {userRole === "ADMIN" && (
              <Button
                onClick={async () => {
                  if (confirm("Are you sure you want to delete this challenge?")) {
                    startTransition(async () => {
                      const result = await deleteChallengeAction(challenge.id)
                      if (result.ok) {
                        toast.success("Challenge deleted")
                        const newData = await getGroupChallengeAction(groupId)
                        if (newData.ok) {
                          setChallenge(newData.challenge ?? null)
                          setGroupRank(newData.groupRank ?? 1)
                        }
                      } else {
                        toast.error(result.error ?? "Failed to delete challenge")
                      }
                    })
                  }
                }}
                disabled={isPending}
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <Progress value={approvalProgress} className="h-1.5" />
      </div>
    )
  }

  // Challenge is scheduled
  if (challenge.status === "SCHEDULED") {
    return (
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-sm font-medium">
                Challenge starts {format(weekRange.start, "EEEE")}
              </div>
              <div className="text-xs text-muted-foreground">
                All {challenge.memberCount} members ready • {challenge.threshold}% to rank up
              </div>
            </div>
          </div>
          <RankBadge rank={groupRank} size="sm" />
        </div>
      </div>
    )
  }

  // Challenge is active
  if (challenge.status === "ACTIVE") {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Challenge Active
              </div>
              <div className="text-xs text-muted-foreground">
                Ends {format(weekRange.end, "EEEE")} • Everyone hit {challenge.threshold}% → {getRankName(groupRank + 1)}
              </div>
            </div>
          </div>
          <RankBadge rank={groupRank} size="sm" />
        </div>
      </div>
    )
  }

  // Challenge succeeded
  if (challenge.status === "SUCCEEDED") {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-xl">🎉</div>
            <div>
              <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Ranked up to {getRankName(groupRank)}!
              </div>
              <div className="text-xs text-muted-foreground">
                Challenge complete
              </div>
            </div>
          </div>
          <CreateChallengeDialog
            groupId={groupId}
            isLeader={userRole === "ADMIN"}
            onChallengeCreated={async () => {
              const newData = await getGroupChallengeAction(groupId)
              if (newData.ok) {
                setChallenge(newData.challenge ?? null)
                setGroupRank(newData.groupRank ?? 1)
              }
            }}
          />
        </div>
      </div>
    )
  }

  // Challenge failed
  if (challenge.status === "FAILED") {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <X className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Challenge incomplete
              </div>
              <div className="text-xs text-muted-foreground">
                Try again next week
              </div>
            </div>
          </div>
          <CreateChallengeDialog
            groupId={groupId}
            isLeader={userRole === "ADMIN"}
            onChallengeCreated={async () => {
              const newData = await getGroupChallengeAction(groupId)
              if (newData.ok) {
                setChallenge(newData.challenge ?? null)
                setGroupRank(newData.groupRank ?? 1)
              }
            }}
          />
        </div>
      </div>
    )
  }

  return null
}
