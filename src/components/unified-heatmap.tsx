"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { format, subWeeks, addDays, startOfWeek } from "date-fns"

// Curated color palette for goals - distinct, accessible colors
const GOAL_COLORS = [
  { bg: "bg-blue-500", ring: "ring-blue-500", hex: "#3b82f6" },
  { bg: "bg-emerald-500", ring: "ring-emerald-500", hex: "#10b981" },
  { bg: "bg-amber-500", ring: "ring-amber-500", hex: "#f59e0b" },
  { bg: "bg-violet-500", ring: "ring-violet-500", hex: "#8b5cf6" },
  { bg: "bg-rose-500", ring: "ring-rose-500", hex: "#f43f5e" },
  { bg: "bg-cyan-500", ring: "ring-cyan-500", hex: "#06b6d4" },
  { bg: "bg-orange-500", ring: "ring-orange-500", hex: "#f97316" },
  { bg: "bg-pink-500", ring: "ring-pink-500", hex: "#ec4899" },
]

type GoalData = {
  id: string
  name: string
  color: (typeof GOAL_COLORS)[number]
}

type DayData = {
  date: string // YYYY-MM-DD
  goals: { goalId: string; count: number }[]
}

type UnifiedHeatmapProps = {
  data: DayData[]
  goals: { id: string; name: string }[]
  className?: string
  weeks?: number
}

export function UnifiedHeatmap({
  data,
  goals,
  className,
  weeks = 12,
}: UnifiedHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null)

  // Assign colors to goals deterministically
  const goalsWithColors: GoalData[] = useMemo(
    () =>
      goals.map((g, i) => ({
        ...g,
        color: GOAL_COLORS[i % GOAL_COLORS.length],
      })),
    [goals]
  )

  const goalColorMap = useMemo(
    () => new Map(goalsWithColors.map((g) => [g.id, g.color])),
    [goalsWithColors]
  )

  const dataMap = useMemo(
    () => new Map(data.map((d) => [d.date, d])),
    [data]
  )

  const today = new Date()
  const todayKey = format(today, "yyyy-MM-dd")

  // Build the grid
  const gridStart = startOfWeek(subWeeks(today, weeks - 1), { weekStartsOn: 0 })

  const grid = useMemo(() => {
    const result: { date: Date; dateKey: string; isFuture: boolean; isToday: boolean }[][] = []
    for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
      const weekStart = addDays(gridStart, weekIndex * 7)
      const weekDays: typeof result[number] = []
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const date = addDays(weekStart, dayIndex)
        const dateKey = format(date, "yyyy-MM-dd")
        weekDays.push({
          date,
          dateKey,
          isFuture: date > today,
          isToday: dateKey === todayKey,
        })
      }
      result.push(weekDays)
    }
    return result
  }, [weeks, gridStart, today, todayKey])

  // Calculate max total for intensity scaling
  const maxTotal = useMemo(() => {
    let max = 1
    for (const d of data) {
      const total = d.goals.reduce((sum, g) => sum + g.count, 0)
      if (total > max) max = total
    }
    return max
  }, [data])

  // Month labels
  const monthSpans = useMemo(() => {
    const spans: { label: string; startWeek: number; endWeek: number }[] = []
    let prevMonth = -1
    for (let weekIndex = 0; weekIndex < grid.length; weekIndex++) {
      const firstDay = grid[weekIndex][0]
      const month = firstDay.date.getMonth()
      if (month !== prevMonth) {
        if (spans.length > 0) {
          spans[spans.length - 1].endWeek = weekIndex - 1
        }
        spans.push({
          label: format(firstDay.date, "MMM"),
          startWeek: weekIndex,
          endWeek: grid.length - 1,
        })
        prevMonth = month
      }
    }
    return spans
  }, [grid])

  const cellSize = 14
  const gap = 3

  // Render a cell with stacked goal segments
  const renderCell = (day: typeof grid[number][number]) => {
    const dayData = dataMap.get(day.dateKey)
    const goalCompletions = dayData?.goals ?? []
    
    // Filter by selected goal if any
    const filteredCompletions = selectedGoal
      ? goalCompletions.filter((g) => g.goalId === selectedGoal)
      : goalCompletions
    
    const total = filteredCompletions.reduce((sum, g) => sum + g.count, 0)
    const hasActivity = total > 0

    // Calculate segments for stacked visualization
    const segments = filteredCompletions
      .filter((g) => g.count > 0)
      .map((g) => ({
        goalId: g.goalId,
        count: g.count,
        color: goalColorMap.get(g.goalId) ?? GOAL_COLORS[0],
      }))

    // Determine background based on activity
    let cellContent
    if (day.isFuture) {
      cellContent = (
        <div
          className="rounded-[3px] border border-dashed border-muted/40 bg-transparent"
          style={{ width: cellSize, height: cellSize }}
        />
      )
    } else if (!hasActivity) {
      cellContent = (
        <div
          className={cn(
            "rounded-[3px] bg-muted/30 dark:bg-muted/20 transition-all duration-150",
            day.isToday && "ring-2 ring-primary/50 ring-offset-1 ring-offset-background"
          )}
          style={{ width: cellSize, height: cellSize }}
        />
      )
    } else if (segments.length === 1) {
      // Single goal - use its color with intensity based on count
      const intensity = Math.min(1, total / Math.max(1, maxTotal / 2))
      const opacityClass = intensity < 0.3 ? "opacity-40" : intensity < 0.6 ? "opacity-70" : "opacity-100"
      cellContent = (
        <div
          className={cn(
            "rounded-[3px] transition-all duration-150",
            segments[0].color.bg,
            opacityClass,
            day.isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background"
          )}
          style={{ width: cellSize, height: cellSize }}
        />
      )
    } else {
      // Multiple goals - create a gradient/stacked effect
      const gradientStops = segments
        .map((s, i) => {
          const pct = ((i + 0.5) / segments.length) * 100
          return `${s.color.hex} ${pct}%`
        })
        .join(", ")
      cellContent = (
        <div
          className={cn(
            "rounded-[3px] transition-all duration-150",
            day.isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background"
          )}
          style={{
            width: cellSize,
            height: cellSize,
            background: `linear-gradient(135deg, ${gradientStops})`,
          }}
        />
      )
    }

    return (
      <div
        key={day.dateKey}
        className="relative cursor-pointer"
        onMouseEnter={() => setHoveredDay(day.dateKey)}
        onMouseLeave={() => setHoveredDay(null)}
        style={{ marginBottom: gap }}
      >
        {cellContent}
        
        {/* Tooltip */}
        {hoveredDay === day.dateKey && !day.isFuture && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
            <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
              <div className="font-medium mb-1">{format(day.date, "MMM d, yyyy")}</div>
              {goalCompletions.length === 0 ? (
                <div className="text-muted-foreground">No activity</div>
              ) : (
                <div className="space-y-0.5">
                  {goalCompletions.map((g) => {
                    const goal = goalsWithColors.find((gd) => gd.id === g.goalId)
                    if (!goal || g.count === 0) return null
                    return (
                      <div key={g.goalId} className="flex items-center gap-2">
                        <span
                          className={cn("w-2 h-2 rounded-full", goal.color.bg)}
                        />
                        <span className="truncate max-w-[120px]">{goal.name}</span>
                        <span className="text-muted-foreground ml-auto">{g.count}x</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-popover border-b border-r rotate-45 -mt-1" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Goal Legend */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedGoal(null)}
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
            selectedGoal === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          )}
        >
          All
        </button>
        {goalsWithColors.map((goal) => (
          <button
            key={goal.id}
            onClick={() => setSelectedGoal(selectedGoal === goal.id ? null : goal.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
              selectedGoal === goal.id
                ? "ring-2 ring-offset-1 ring-offset-background"
                : "hover:bg-muted/50",
              selectedGoal === goal.id ? goal.color.ring : "",
              selectedGoal === goal.id ? "bg-muted" : "bg-muted/30"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full shrink-0", goal.color.bg)} />
            <span className="truncate max-w-[100px]">{goal.name}</span>
          </button>
        ))}
      </div>

      {/* Heatmap Grid */}
      <div className="inline-block">
        {/* Month labels */}
        <div className="relative h-4 mb-1" style={{ marginLeft: 20 }}>
          {monthSpans.map(({ label, startWeek, endWeek }) => {
            const position = ((startWeek + endWeek) / 2) * (cellSize + gap)
            return (
              <span
                key={`${label}-${startWeek}`}
                className="absolute text-[10px] text-muted-foreground whitespace-nowrap -translate-x-1/2"
                style={{ left: position }}
              >
                {label}
              </span>
            )
          })}
        </div>

        {/* Grid with day labels */}
        <div className="flex">
          {/* Day labels */}
          <div
            className="flex flex-col text-[10px] text-muted-foreground pr-1"
            style={{ width: 20 }}
          >
            {["S", "M", "T", "W", "T", "F", "S"].map((label, i) => (
              <div
                key={i}
                style={{ height: cellSize, marginBottom: i < 6 ? gap : 0 }}
                className="flex items-center justify-end"
              >
                {i % 2 === 1 ? label : ""}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {grid.map((week, weekIndex) => (
            <div
              key={weekIndex}
              className="flex flex-col"
              style={{ marginRight: weekIndex < weeks - 1 ? gap : 0 }}
            >
              {week.map((day) => renderCell(day))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend - show empty vs activity, and note about colors */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="rounded-[2px] bg-muted/30" style={{ width: 10, height: 10 }} />
          <span>No activity</span>
        </div>
        <span>•</span>
        <span>Colors match goals above</span>
        {goals.length > 1 && (
          <>
            <span>•</span>
            <span>Blended = multiple goals</span>
          </>
        )}
      </div>
    </div>
  )
}
