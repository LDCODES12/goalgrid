"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO, isBefore, startOfDay, isAfter } from "date-fns"
import { CalendarIcon, Minus, Plus, Check } from "lucide-react"
import { toast } from "sonner"
import { logHistoricalCheckInAction } from "@/app/actions/checkins"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

interface ActivityLogDialogProps {
  goalId: string
  goalName: string
  dailyTarget: number
  createdAt: Date
  // Map of date (YYYY-MM-DD) to completion count
  checkInsByDate: Record<string, number>
}

export function ActivityLogDialog({
  goalId,
  goalName,
  dailyTarget,
  createdAt,
  checkInsByDate,
}: ActivityLogDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [count, setCount] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [localCheckIns, setLocalCheckIns] = useState(checkInsByDate)
  const router = useRouter()

  // Get today at midnight for comparison
  const today = startOfDay(new Date())
  const goalCreatedDate = startOfDay(createdAt)

  // When a date is selected, load its count
  useEffect(() => {
    if (selectedDate) {
      const dateKey = format(selectedDate, "yyyy-MM-dd")
      setCount(localCheckIns[dateKey] ?? 0)
    }
  }, [selectedDate, localCheckIns])

  // Reset state when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setLocalCheckIns(checkInsByDate)
      setSelectedDate(undefined)
      setCount(0)
    }
    setOpen(newOpen)
  }

  const handleSave = useCallback(() => {
    if (!selectedDate) return

    const dateKey = format(selectedDate, "yyyy-MM-dd")
    const previousCount = localCheckIns[dateKey] ?? 0

    // Optimistic update
    setLocalCheckIns((prev) => ({
      ...prev,
      [dateKey]: count,
    }))

    startTransition(async () => {
      const result = await logHistoricalCheckInAction({
        goalId,
        date: dateKey,
        count,
      })

      if (!result.ok) {
        // Revert on error
        setLocalCheckIns((prev) => ({
          ...prev,
          [dateKey]: previousCount,
        }))
        toast.error(result.error ?? "Could not save activity")
        return
      }

      toast.success(`Logged ${count} completion${count !== 1 ? "s" : ""} for ${format(selectedDate, "MMM d, yyyy")}`)
      router.refresh()
    })
  }, [selectedDate, count, localCheckIns, goalId, router])

  const selectedDateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null
  const hasUnsavedChanges = selectedDateKey && count !== (localCheckIns[selectedDateKey] ?? 0)
  const isMultiTarget = dailyTarget > 1

  // Custom day render to show completion indicators
  const modifiers = {
    completed: (date: Date) => {
      const dateKey = format(date, "yyyy-MM-dd")
      const dayCount = localCheckIns[dateKey] ?? 0
      return dayCount >= dailyTarget
    },
    partial: (date: Date) => {
      const dateKey = format(date, "yyyy-MM-dd")
      const dayCount = localCheckIns[dateKey] ?? 0
      return dayCount > 0 && dayCount < dailyTarget
    },
  }

  const modifiersClassNames = {
    completed: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium",
    partial: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  }

  // Disable future dates and dates before goal creation
  const disabledDays = [
    { from: today, to: new Date(2100, 0, 1) }, // Future dates
    { from: new Date(1900, 0, 1), to: startOfDay(new Date(goalCreatedDate.getTime() - 86400000)) }, // Before goal creation
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarIcon className="h-4 w-4 mr-1" />
          Log Past Activity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Log Past Activity</DialogTitle>
          <DialogDescription>
            Record completions for <span className="font-medium text-foreground">{goalName}</span> on past dates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Calendar */}
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={disabledDays}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              defaultMonth={selectedDate ?? new Date()}
              className="rounded-md border"
            />
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
              <span>Complete</span>
            </div>
            {isMultiTarget && (
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-amber-500/20 border border-amber-500/30" />
                <span>Partial</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border border-muted-foreground/30" />
              <span>None</span>
            </div>
          </div>

          {/* Selected Day Panel */}
          {selectedDate && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="text-sm font-medium">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </div>

              {isMultiTarget ? (
                // Multi-target: increment/decrement counter
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Completions
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCount((c) => Math.max(0, c - 1))}
                      disabled={count <= 0 || isPending}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="w-16 text-center">
                      <span className="text-lg font-semibold">{count}</span>
                      <span className="text-muted-foreground">/{dailyTarget}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCount((c) => Math.min(dailyTarget, c + 1))}
                      disabled={count >= dailyTarget || isPending}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                // Single-target: toggle button
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Status
                  </span>
                  <Button
                    variant={count > 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCount((c) => (c > 0 ? 0 : 1))}
                    disabled={isPending}
                    className={cn(
                      count > 0 && "bg-emerald-600 hover:bg-emerald-700"
                    )}
                  >
                    {count > 0 ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Completed
                      </>
                    ) : (
                      "Mark Complete"
                    )}
                  </Button>
                </div>
              )}

              {/* Save Button */}
              {hasUnsavedChanges && (
                <Button
                  onClick={handleSave}
                  disabled={isPending}
                  className="w-full"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </div>
          )}

          {/* Prompt to select a date */}
          {!selectedDate && (
            <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              Select a date to log or edit activity
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
