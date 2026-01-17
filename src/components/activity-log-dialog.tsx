"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format, startOfDay, subDays } from "date-fns"
import { CalendarIcon, Minus, Plus, Check, CalendarRange, Repeat, Flame } from "lucide-react"
import { toast } from "sonner"
import { logHistoricalCheckInAction, bulkLogHistoricalAction } from "@/app/actions/checkins"
import { getDateRange, getWeekdayDates, getStreakDates } from "@/lib/time"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ActivityLogDialogProps {
  goalId: string
  goalName: string
  dailyTarget: number
  checkInsByDate: Record<string, number>
}

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
]

export function ActivityLogDialog({
  goalId,
  goalName,
  dailyTarget,
  checkInsByDate,
}: ActivityLogDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [localCheckIns, setLocalCheckIns] = useState(checkInsByDate)
  const router = useRouter()

  const today = startOfDay(new Date())
  const yesterday = subDays(today, 1)

  // Single Day state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [singleCount, setSingleCount] = useState(0)

  // Date Range state
  const [rangeStart, setRangeStart] = useState<Date | undefined>(undefined)
  const [rangeEnd, setRangeEnd] = useState<Date | undefined>(undefined)
  const [rangeCount, setRangeCount] = useState(1)

  // Pattern state
  const [patternStart, setPatternStart] = useState<Date | undefined>(undefined)
  const [patternEnd, setPatternEnd] = useState<Date | undefined>(undefined)
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 3, 5]) // Mon, Wed, Fri
  const [patternCount, setPatternCount] = useState(1)

  // Streak state
  const [streakLength, setStreakLength] = useState(30)
  const [streakUnit, setStreakUnit] = useState<"days" | "weeks" | "months">("days")
  const [streakCount, setStreakCount] = useState(1)

  // Sync with props
  useEffect(() => {
    setLocalCheckIns(checkInsByDate)
  }, [checkInsByDate])

  // When single date is selected, load its count
  useEffect(() => {
    if (selectedDate) {
      const dateKey = format(selectedDate, "yyyy-MM-dd")
      setSingleCount(localCheckIns[dateKey] ?? 0)
    }
  }, [selectedDate, localCheckIns])

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setLocalCheckIns(checkInsByDate)
      setSelectedDate(undefined)
      setSingleCount(0)
      setRangeStart(undefined)
      setRangeEnd(undefined)
      setPatternStart(undefined)
      setPatternEnd(undefined)
    }
    setOpen(newOpen)
  }

  // Single day save
  const handleSingleSave = useCallback(() => {
    if (!selectedDate) return
    const dateKey = format(selectedDate, "yyyy-MM-dd")
    const previousCount = localCheckIns[dateKey] ?? 0

    setLocalCheckIns((prev) => ({ ...prev, [dateKey]: singleCount }))

    startTransition(async () => {
      const result = await logHistoricalCheckInAction({
        goalId,
        date: dateKey,
        count: singleCount,
      })

      if (!result.ok) {
        setLocalCheckIns((prev) => ({ ...prev, [dateKey]: previousCount }))
        toast.error(result.error ?? "Could not save activity")
        return
      }

      toast.success(`Logged ${singleCount} completion${singleCount !== 1 ? "s" : ""} for ${format(selectedDate, "MMM d, yyyy")}`)
      router.refresh()
    })
  }, [selectedDate, singleCount, localCheckIns, goalId, router])

  // Bulk save (used by range, pattern, streak)
  const handleBulkSave = useCallback((dates: string[], count: number, description: string) => {
    if (dates.length === 0) {
      toast.error("No dates to log")
      return
    }

    startTransition(async () => {
      const result = await bulkLogHistoricalAction({
        goalId,
        dates,
        countPerDay: count,
        mode: "set",
      })

      if (!result.ok) {
        toast.error(result.error ?? "Could not save activity")
        return
      }

      toast.success(`${description}: ${result.daysAffected} days updated`)
      router.refresh()
      
      // Update local state
      const newCheckIns = { ...localCheckIns }
      for (const date of dates) {
        newCheckIns[date] = count
      }
      setLocalCheckIns(newCheckIns)
    })
  }, [goalId, localCheckIns, router])

  // Calculate dates for each mode
  const rangeDates = rangeStart && rangeEnd ? getDateRange(rangeStart, rangeEnd).filter(d => d < format(today, "yyyy-MM-dd")) : []
  const patternDates = patternStart && patternEnd && selectedWeekdays.length > 0 
    ? getWeekdayDates(patternStart, patternEnd, selectedWeekdays).filter(d => d < format(today, "yyyy-MM-dd"))
    : []
  
  const getStreakEndDate = () => yesterday
  const getStreakDays = () => {
    if (streakUnit === "days") return streakLength
    if (streakUnit === "weeks") return streakLength * 7
    if (streakUnit === "months") return streakLength * 30
    return streakLength
  }
  const streakDates = getStreakDates(getStreakEndDate(), getStreakDays())

  const selectedDateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null
  const hasSingleChanges = selectedDateKey && singleCount !== (localCheckIns[selectedDateKey] ?? 0)
  const isMultiTarget = dailyTarget > 1

  // Modifiers for calendar
  const modifiers = {
    completed: (date: Date) => {
      const dateKey = format(date, "yyyy-MM-dd")
      return (localCheckIns[dateKey] ?? 0) >= dailyTarget
    },
    partial: (date: Date) => {
      const dateKey = format(date, "yyyy-MM-dd")
      const count = localCheckIns[dateKey] ?? 0
      return count > 0 && count < dailyTarget
    },
  }

  const modifiersClassNames = {
    completed: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium",
    partial: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  }

  const disabledDays = [{ from: today, to: new Date(2100, 0, 1) }]

  const toggleWeekday = (day: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  // Count picker component
  const CountPicker = ({ value, onChange, max }: { value: number; onChange: (v: number) => void; max: number }) => (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1 || isPending}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <div className="w-16 text-center">
        <span className="text-lg font-semibold">{value}</span>
        <span className="text-muted-foreground">/{max}</span>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max || isPending}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarIcon className="h-4 w-4 mr-1" />
          Log Past Activity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Past Activity</DialogTitle>
          <DialogDescription>
            Record historical completions for <span className="font-medium text-foreground">{goalName}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-9">
            <TabsTrigger value="single" className="text-xs gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Single</span>
            </TabsTrigger>
            <TabsTrigger value="range" className="text-xs gap-1">
              <CalendarRange className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Range</span>
            </TabsTrigger>
            <TabsTrigger value="pattern" className="text-xs gap-1">
              <Repeat className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Pattern</span>
            </TabsTrigger>
            <TabsTrigger value="streak" className="text-xs gap-1">
              <Flame className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Streak</span>
            </TabsTrigger>
          </TabsList>

          {/* Single Day Tab */}
          <TabsContent value="single" className="space-y-4">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={disabledDays}
                modifiers={modifiers}
                modifiersClassNames={modifiersClassNames}
                defaultMonth={yesterday}
                className="rounded-md border"
              />
            </div>

            {selectedDate && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="text-sm font-medium">
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Completions</span>
                  {isMultiTarget ? (
                    <CountPicker value={singleCount} onChange={setSingleCount} max={dailyTarget} />
                  ) : (
                    <Button
                      variant={singleCount > 0 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSingleCount((c) => (c > 0 ? 0 : 1))}
                      disabled={isPending}
                      className={cn(singleCount > 0 && "bg-emerald-600 hover:bg-emerald-700")}
                    >
                      {singleCount > 0 ? <><Check className="h-4 w-4 mr-1" />Completed</> : "Mark Complete"}
                    </Button>
                  )}
                </div>
                {hasSingleChanges && (
                  <Button onClick={handleSingleSave} disabled={isPending} className="w-full">
                    {isPending ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Date Range Tab */}
          <TabsContent value="range" className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Log activity for every day in a date range.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={rangeStart ? format(rangeStart, "yyyy-MM-dd") : ""}
                  onChange={(e) => setRangeStart(e.target.value ? new Date(e.target.value + "T12:00:00") : undefined)}
                  max={format(yesterday, "yyyy-MM-dd")}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Input
                  type="date"
                  value={rangeEnd ? format(rangeEnd, "yyyy-MM-dd") : ""}
                  onChange={(e) => setRangeEnd(e.target.value ? new Date(e.target.value + "T12:00:00") : undefined)}
                  max={format(yesterday, "yyyy-MM-dd")}
                  className="h-9"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              {isMultiTarget && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Completions per day</span>
                  <CountPicker value={rangeCount} onChange={setRangeCount} max={dailyTarget} />
                </div>
              )}
              
              {rangeDates.length > 0 ? (
                <div className="text-sm text-emerald-600 font-medium">
                  {rangeDates.length} days selected
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Select start and end dates above
                </div>
              )}

              <Button
                onClick={() => handleBulkSave(rangeDates, rangeCount, "Date range")}
                disabled={isPending || rangeDates.length === 0}
                className="w-full"
              >
                {isPending ? "Saving..." : rangeDates.length > 0 ? `Log ${rangeDates.length} days` : "Log Activity"}
              </Button>
            </div>
          </TabsContent>

          {/* Pattern Tab */}
          <TabsContent value="pattern" className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Log activity for specific weekdays within a date range.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={patternStart ? format(patternStart, "yyyy-MM-dd") : ""}
                  onChange={(e) => setPatternStart(e.target.value ? new Date(e.target.value + "T12:00:00") : undefined)}
                  max={format(yesterday, "yyyy-MM-dd")}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Input
                  type="date"
                  value={patternEnd ? format(patternEnd, "yyyy-MM-dd") : ""}
                  onChange={(e) => setPatternEnd(e.target.value ? new Date(e.target.value + "T12:00:00") : undefined)}
                  max={format(yesterday, "yyyy-MM-dd")}
                  className="h-9"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Which days?</Label>
                <div className="flex gap-1">
                  {WEEKDAYS.map((day) => (
                    <Button
                      key={day.value}
                      variant={selectedWeekdays.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "flex-1 h-8 px-0 text-xs",
                        selectedWeekdays.includes(day.value) && "bg-primary"
                      )}
                      onClick={() => toggleWeekday(day.value)}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>

              {isMultiTarget && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Completions per day</span>
                  <CountPicker value={patternCount} onChange={setPatternCount} max={dailyTarget} />
                </div>
              )}

              {patternDates.length > 0 ? (
                <div className="text-sm text-emerald-600 font-medium">
                  {patternDates.length} days match your pattern
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Select date range and weekdays
                </div>
              )}

              <Button
                onClick={() => handleBulkSave(patternDates, patternCount, "Weekday pattern")}
                disabled={isPending || patternDates.length === 0}
                className="w-full"
              >
                {isPending ? "Saving..." : patternDates.length > 0 ? `Log ${patternDates.length} days` : "Log Activity"}
              </Button>
            </div>
          </TabsContent>

          {/* Streak Tab */}
          <TabsContent value="streak" className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Quickly log a consecutive streak ending yesterday.
            </p>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">I did this every day for...</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={streakLength}
                    onChange={(e) => setStreakLength(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
                    className="w-20 h-9"
                  />
                  <Select value={streakUnit} onValueChange={(v) => setStreakUnit(v as typeof streakUnit)}>
                    <SelectTrigger className="w-24 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">days</SelectItem>
                      <SelectItem value="weeks">weeks</SelectItem>
                      <SelectItem value="months">months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isMultiTarget && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Completions per day</span>
                  <CountPicker value={streakCount} onChange={setStreakCount} max={dailyTarget} />
                </div>
              )}

              <div className="rounded-md bg-background/50 p-3 space-y-1">
                <div className="text-sm font-medium text-emerald-600">
                  {streakDates.length} consecutive days
                </div>
                <div className="text-xs text-muted-foreground">
                  {streakDates.length > 0 && `${streakDates[0]} → ${streakDates[streakDates.length - 1]}`}
                </div>
              </div>

              <Button
                onClick={() => handleBulkSave(streakDates, streakCount, "Streak")}
                disabled={isPending || streakDates.length === 0}
                className="w-full"
              >
                {isPending ? "Saving..." : `Log ${streakDates.length}-day streak`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t">
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
      </DialogContent>
    </Dialog>
  )
}
