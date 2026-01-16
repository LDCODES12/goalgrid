"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { checkInGoalAction, undoCheckInAction } from "@/app/actions/checkins"
import { ConfettiBurst } from "@/components/confetti-burst"
import { Undo2 } from "lucide-react"

interface CheckInButtonProps {
  goalId: string
  completed: boolean
  label?: string
  todayCount?: number
  dailyTarget?: number
}

export function CheckInButton({
  goalId,
  completed,
  label = "Complete",
  todayCount = 0,
  dailyTarget = 1,
}: CheckInButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticCount, setOptimisticCount] = useState(todayCount)
  const [showConfetti, setShowConfetti] = useState(false)
  const router = useRouter()

  const isMultiTarget = dailyTarget > 1
  const isDone = isMultiTarget ? optimisticCount >= dailyTarget : optimisticCount > 0

  const handleCheckIn = () => {
    if (isDone) return
    setOptimisticCount((c) => c + 1)
    const formData = new FormData()
    formData.set("goalId", goalId)
    startTransition(async () => {
      const result = await checkInGoalAction(formData)
      if (!result.ok) {
        setOptimisticCount((c) => c - 1)
        toast.error(result.error ?? "Could not log completion.")
        return
      }
      if (result.streakMilestone) {
        toast.success(`Streak milestone: ${result.streakMilestone} days!`)
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 1200)
      } else {
        toast.success("Done!")
      }
      router.refresh()
    })
  }

  const handleUndo = () => {
    if (optimisticCount <= 0) return
    setOptimisticCount((c) => c - 1)
    startTransition(async () => {
      const result = await undoCheckInAction(goalId)
      if (!result.ok) {
        setOptimisticCount((c) => c + 1)
        toast.error(result.error ?? "Could not undo.")
        return
      }
      toast.success("Undone")
      router.refresh()
    })
  }

  // For multi-target goals
  if (isMultiTarget) {
    const currentCount = optimisticCount
    const canAdd = currentCount < dailyTarget
    const canUndo = currentCount > 0

    return (
      <div className="relative inline-flex items-center gap-1">
        {canUndo && (
          <Button
            onClick={handleUndo}
            disabled={isPending}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
            title="Undo last"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        )}
        <Button
          onClick={handleCheckIn}
          disabled={isPending || !canAdd}
          variant={currentCount >= dailyTarget ? "secondary" : "default"}
          size="default"
        >
          {currentCount >= dailyTarget 
            ? `Done (${currentCount}/${dailyTarget})` 
            : `+1 (${currentCount}/${dailyTarget})`
          }
        </Button>
        {showConfetti && <ConfettiBurst />}
      </div>
    )
  }

  // For single-target goals
  return (
    <div className="relative inline-flex items-center gap-1">
      {isDone && (
        <Button
          onClick={handleUndo}
          disabled={isPending}
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
          title="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
      )}
      <Button
        onClick={handleCheckIn}
        disabled={isPending || isDone}
        variant={isDone ? "secondary" : "default"}
        size="default"
      >
        {isDone ? "Done" : label}
      </Button>
      {showConfetti && <ConfettiBurst />}
    </div>
  )
}
