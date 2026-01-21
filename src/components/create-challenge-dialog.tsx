"use client"

import { useState } from "react"
import { Loader2, Trophy, Users, UsersRound, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createChallengeV2Action } from "@/app/actions/challenges"
import { toast } from "sonner"

interface CreateChallengeDialogProps {
  groupId: string
  isLeader: boolean
}

type ChallengeMode = "STANDARD" | "TEAM_VS_TEAM" | "DUO_COMPETITION"

const CHALLENGE_MODES = [
  {
    value: "STANDARD" as ChallengeMode,
    label: "Standard Challenge",
    description: "Everyone competes individually",
    icon: Trophy,
    color: "text-blue-500",
  },
  {
    value: "TEAM_VS_TEAM" as ChallengeMode,
    label: "Team vs Team",
    description: "Group split into two teams",
    icon: Users,
    color: "text-emerald-500",
  },
  {
    value: "DUO_COMPETITION" as ChallengeMode,
    label: "Duo Competition",
    description: "Compete as pairs/duos",
    icon: UsersRound,
    color: "text-violet-500",
  },
]

const DURATION_OPTIONS = [
  { value: 3, label: "3 days" },
  { value: 7, label: "1 week" },
  { value: 14, label: "2 weeks" },
  { value: 21, label: "3 weeks" },
  { value: 30, label: "1 month" },
]

const THRESHOLD_OPTIONS = [
  { value: 70, label: "70% - Relaxed" },
  { value: 80, label: "80% - Moderate" },
  { value: 90, label: "90% - Challenging" },
  { value: 95, label: "95% - Hard" },
  { value: 100, label: "100% - Perfect" },
]

export function CreateChallengeDialog({ groupId, isLeader }: CreateChallengeDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<ChallengeMode>("STANDARD")
  const [durationDays, setDurationDays] = useState(7)
  const [threshold, setThreshold] = useState(90)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const result = await createChallengeV2Action({
        groupId,
        mode,
        durationDays,
        threshold,
      })

      if (result.ok) {
        toast.success("Challenge created!", {
          description: "Waiting for all members to approve.",
        })
        setOpen(false)
      } else {
        toast.error("Failed to create challenge", {
          description: result.error,
        })
      }
    } catch (error) {
      toast.error("An error occurred", {
        description: "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!isLeader) {
    return null // Only leaders can create challenges
  }

  const selectedModeInfo = CHALLENGE_MODES.find((m) => m.value === mode)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-sm hover:shadow-md transition-all duration-200">
          <Zap className="h-4 w-4" />
          Start Challenge
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-500" />
            Create Group Challenge
          </DialogTitle>
          <DialogDescription>
            Configure a challenge for your group. All members must approve before it starts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Challenge Mode */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Challenge Mode</Label>
            <div className="grid gap-3">
              {CHALLENGE_MODES.map((modeOption) => {
                const Icon = modeOption.icon
                const isSelected = mode === modeOption.value
                return (
                  <button
                    key={modeOption.value}
                    type="button"
                    onClick={() => setMode(modeOption.value)}
                    className={`group relative flex items-start gap-3 rounded-lg border p-4 text-left transition-all duration-200 ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    }`}
                  >
                    <div className={`mt-0.5 ${isSelected ? modeOption.color : "text-muted-foreground"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{modeOption.label}</p>
                        {isSelected && (
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{modeOption.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="text-sm font-semibold">
              Duration
            </Label>
            <Select value={String(durationDays)} onValueChange={(v) => setDurationDays(Number(v))}>
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Completion Threshold */}
          <div className="space-y-2">
            <Label htmlFor="threshold" className="text-sm font-semibold">
              Completion Threshold
            </Label>
            <Select value={String(threshold)} onValueChange={(v) => setThreshold(Number(v))}>
              <SelectTrigger id="threshold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THRESHOLD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Each member/team/duo must reach this completion rate to succeed
            </p>
          </div>

          {/* Mode-specific info */}
          {mode === "TEAM_VS_TEAM" && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-xs text-muted-foreground">
                <strong className="text-emerald-700 dark:text-emerald-400">Team mode:</strong> Members will be
                randomly assigned to two teams. Teams compete for the highest combined completion rate.
              </p>
            </div>
          )}
          {mode === "DUO_COMPETITION" && (
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <p className="text-xs text-muted-foreground">
                <strong className="text-violet-700 dark:text-violet-400">Duo mode:</strong> Members will be
                randomly paired into duos. Each duo competes together as a team.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Challenge
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
