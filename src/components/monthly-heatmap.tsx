"use client"

import { cn } from "@/lib/utils"
import { subDays, format, getDay, startOfWeek } from "date-fns"

type DayData = {
  date: string // YYYY-MM-DD
  count: number
}

export function MonthlyHeatmap({
  data,
  className,
}: {
  data: DayData[]
  className?: string
}) {
  const dataMap = new Map(data.map((d) => [d.date, d]))
  const today = new Date()
  
  // Find the Sunday 11 weeks ago (12 weeks total including this week)
  const startDate = startOfWeek(subDays(today, 77), { weekStartsOn: 0 })
  
  // Generate all days from startDate to today
  const totalDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  // Build weeks array (each week is an array of 7 days, Sunday-Saturday)
  const weeks: { date: Date; dateKey: string }[][] = []
  let currentWeek: { date: Date; dateKey: string }[] = []
  
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    const dayOfWeek = getDay(date)
    
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    
    currentWeek.push({
      date,
      dateKey: format(date, "yyyy-MM-dd"),
    })
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  // Find max for intensity
  const maxCount = Math.max(1, ...data.map((d) => d.count))

  // Get month labels - only show when month changes, with proper spacing
  const monthLabels: { label: string; colIndex: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, colIndex) => {
    const firstDay = week[0]
    if (firstDay) {
      const month = firstDay.date.getMonth()
      if (month !== lastMonth) {
        monthLabels.push({ label: format(firstDay.date, "MMM"), colIndex })
        lastMonth = month
      }
    }
  })

  // Cell size + gap
  const cellSize = 10 // px
  const gap = 2 // px
  const cellTotal = cellSize + gap

  return (
    <div className={cn("text-xs", className)}>
      {/* Month labels row - positioned absolutely based on column index */}
      <div className="relative h-4 mb-1" style={{ marginLeft: 20 }}>
        {monthLabels.map(({ label, colIndex }) => (
          <span
            key={`${label}-${colIndex}`}
            className="absolute text-[10px] text-muted-foreground"
            style={{ left: colIndex * cellTotal }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Grid with day labels */}
      <div className="flex">
        {/* Day labels */}
        <div className="flex flex-col text-[10px] text-muted-foreground w-5 shrink-0">
          {["", "M", "", "W", "", "F", ""].map((label, i) => (
            <div 
              key={i} 
              className="flex items-center justify-end pr-1"
              style={{ height: cellSize, marginBottom: i < 6 ? gap : 0 }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Weeks grid */}
        <div className="flex" style={{ gap }}>
          {weeks.map((week, colIndex) => (
            <div key={colIndex} className="flex flex-col" style={{ gap }}>
              {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                const day = week.find(d => getDay(d.date) === dayIndex)
                if (!day) {
                  return <div key={dayIndex} style={{ width: cellSize, height: cellSize }} />
                }
                
                const dayData = dataMap.get(day.dateKey)
                const count = dayData?.count ?? 0
                const intensity = count / maxCount

                let bg = "bg-muted/50"
                if (count > 0) {
                  bg = intensity < 0.33
                    ? "bg-emerald-500/40"
                    : intensity < 0.66
                    ? "bg-emerald-500/70"
                    : "bg-emerald-500"
                }

                return (
                  <div
                    key={day.dateKey}
                    className={cn("rounded-sm", bg)}
                    style={{ width: cellSize, height: cellSize }}
                    title={`${format(day.date, "MMM d")}: ${count}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
