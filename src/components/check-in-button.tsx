"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { checkInGoalAction } from "@/app/actions/checkins"
import { ConfettiBurst } from "@/components/confetti-burst"

export function CheckInButton({
  goalId,
  completed,
  label = "Complete",
  isPartial = false,
}: {
  goalId: string
  completed: boolean
  label?: string
  isPartial?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [optimisticDone, setOptimisticDone] = useState(completed)
  const [showConfetti, setShowConfetti] = useState(false)
  const router = useRouter()

  const handleCheckIn = () => {
    if (optimisticDone) return
    setOptimisticDone(true)
    const formData = new FormData()
    formData.set("goalId", goalId)
    if (isPartial) {
      formData.set("isPartial", "true")
    }
    startTransition(async () => {
      const result = await checkInGoalAction(formData)
      if (!result.ok) {
        setOptimisticDone(false)
        toast.error(result.error ?? "Could not log completion.")
        return
      }
      if (result.streakMilestone) {
        toast.success(`Streak milestone: ${result.streakMilestone} days`)
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 1200)
      } else if (isPartial) {
        toast.success("Mini completion logged! Every bit counts.")
      } else {
        toast.success("Completion logged!")
      }
      router.refresh()
    })
  }

  return (
    <div className="relative inline-flex">
      <Button
        onClick={handleCheckIn}
        disabled={isPending || optimisticDone}
        variant={isPartial ? "outline" : optimisticDone ? "secondary" : "default"}
        size={isPartial ? "sm" : "default"}
      >
        {optimisticDone ? (isPartial ? "Done" : "Done today") : label}
      </Button>
      {showConfetti ? <ConfettiBurst /> : null}
    </div>
  )
}
