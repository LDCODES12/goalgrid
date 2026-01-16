"use client"

import { cn } from "@/lib/utils"
import { subDays, format, startOfWeek, getDay } from "date-fns"

type DayData = {
  date: string // YYYY-MM-DD
  count: number
  isPartial?: boolean
}

export function MonthlyHeatmap({
  data,
  className,
}: {
  data: DayData[]
  className?: string
}) {
  // Create a map for quick lookup
  const dataMap = new Map(data.map((d) => [d.date, d]))

  // Generate last 12 weeks (84 days) of data
  const today = new Date()
  const days: { date: Date; dateKey: string }[] = []

  // Start from 83 days ago to today
  for (let i = 83; i >= 0; i--) {
    const date = subDays(today, i)
    days.push({
      date,
      dateKey: format(date, "yyyy-MM-dd"),
    })
  }

  // Group by weeks (columns)
  const weeks: typeof days[] = []
  let currentWeek: typeof days = []

  for (const day of days) {
    const dayOfWeek = getDay(day.date) // 0 = Sunday
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(day)
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  // Find max for intensity calculation
  const maxCount = Math.max(1, ...data.map((d) => d.count))

  // Month labels
  const months = new Set<string>()
  const monthPositions: { label: string; weekIndex: number }[] = []
  weeks.forEach((week, weekIndex) => {
    const firstDay = week[0]
    if (firstDay) {
      const monthLabel = format(firstDay.date, "MMM")
      if (!months.has(monthLabel)) {
        months.add(monthLabel)
        monthPositions.push({ label: monthLabel, weekIndex })
      }
    }
  })

  return (
    <div className={cn("space-y-1", className)}>
      {/* Month labels */}
      <div className="flex text-[10px] text-muted-foreground">
        <div className="w-4" /> {/* Spacer for day labels */}
        <div className="flex flex-1">
          {monthPositions.map(({ label, weekIndex }) => (
            <div
              key={`${label}-${weekIndex}`}
              className="text-left"
              style={{
                marginLeft: weekIndex === 0 ? 0 : `${(weekIndex - (monthPositions.findIndex(m => m.label === label && m.weekIndex === weekIndex) > 0 ? monthPositions[monthPositions.findIndex(m => m.label === label && m.weekIndex === weekIndex) - 1].weekIndex : 0) - 1) * 10}px`,
                minWidth: "24px",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground pr-1">
          <span className="h-2" /> {/* Sun */}
          <span className="h-2">M</span>
          <span className="h-2" /> {/* Tue */}
          <span className="h-2">W</span>
          <span className="h-2" /> {/* Thu */}
          <span className="h-2">F</span>
          <span className="h-2" /> {/* Sat */}
        </div>

        {/* Grid */}
        <div className="flex gap-0.5">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-0.5">
              {/* Pad the first week if it doesn't start on Sunday */}
              {weekIndex === 0 &&
                Array.from({ length: getDay(week[0].date) }).map((_, i) => (
                  <div key={`pad-${i}`} className="h-2 w-2" />
                ))}
              {week.map((day) => {
                const dayData = dataMap.get(day.dateKey)
                const count = dayData?.count ?? 0
                const isPartial = dayData?.isPartial ?? false
                const intensity = count / maxCount

                let bg = "bg-muted"
                if (count > 0) {
                  if (isPartial) {
                    bg = intensity < 0.5 ? "bg-amber-400/50" : "bg-amber-500"
                  } else {
                    bg =
                      intensity < 0.33
                        ? "bg-emerald-400/40"
                        : intensity < 0.66
                        ? "bg-emerald-500/70"
                        : "bg-emerald-500"
                  }
                }

                return (
                  <div
                    key={day.dateKey}
                    className={cn(
                      "h-2 w-2 rounded-[2px] transition-colors",
                      bg
                    )}
                    title={`${format(day.date, "MMM d")}: ${count} completion${count !== 1 ? "s" : ""}${isPartial ? " (partial)" : ""}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground pt-1">
        <span>Less</span>
        <div className="h-2 w-2 rounded-[2px] bg-muted" />
        <div className="h-2 w-2 rounded-[2px] bg-emerald-400/40" />
        <div className="h-2 w-2 rounded-[2px] bg-emerald-500/70" />
        <div className="h-2 w-2 rounded-[2px] bg-emerald-500" />
        <span>More</span>
      </div>
    </div>
  )
}
