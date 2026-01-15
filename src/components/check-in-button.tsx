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
  label = "Check in",
}: {
  goalId: string
  completed: boolean
  label?: string
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
    startTransition(async () => {
      const result = await checkInGoalAction(formData)
      if (!result.ok) {
        setOptimisticDone(false)
        toast.error(result.error ?? "Could not check in.")
        return
      }
      if (result.streakMilestone) {
        toast.success(`Streak milestone: ${result.streakMilestone} days`)
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 1200)
      } else {
        toast.success("Check-in logged!")
      }
      router.refresh()
    })
  }

  return (
    <div className="relative inline-flex">
      <Button
        onClick={handleCheckIn}
        disabled={isPending || optimisticDone}
        variant={optimisticDone ? "secondary" : "default"}
      >
        {optimisticDone ? "Done today" : label}
      </Button>
      {showConfetti ? <ConfettiBurst /> : null}
    </div>
  )
}
