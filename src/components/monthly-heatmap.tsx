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

  // Get month labels for first week of each month
  const monthLabels: { label: string; colIndex: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, colIndex) => {
    const firstDay = week.find(d => d) // First day in week
    if (firstDay) {
      const month = firstDay.date.getMonth()
      if (month !== lastMonth) {
        monthLabels.push({ label: format(firstDay.date, "MMM"), colIndex })
        lastMonth = month
      }
    }
  })

  return (
    <div className={cn("text-xs", className)}>
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Last 12 weeks
      </div>
      
      {/* Month labels row */}
      <div className="flex mb-1 ml-6">
        {weeks.map((_, colIndex) => {
          const monthLabel = monthLabels.find(m => m.colIndex === colIndex)
          return (
            <div key={colIndex} className="w-3 mr-[2px] text-[10px] text-muted-foreground">
              {monthLabel?.label || ""}
            </div>
          )
        })}
      </div>

      {/* Grid with day labels */}
      <div className="flex">
        {/* Day labels */}
        <div className="flex flex-col mr-1 text-[10px] text-muted-foreground">
          {["", "M", "", "W", "", "F", ""].map((label, i) => (
            <div key={i} className="h-3 flex items-center justify-end pr-1">
              {label}
            </div>
          ))}
        </div>

        {/* Weeks grid */}
        <div className="flex gap-[2px]">
          {weeks.map((week, colIndex) => (
            <div key={colIndex} className="flex flex-col gap-[2px]">
              {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                const day = week.find(d => getDay(d.date) === dayIndex)
                if (!day) {
                  return <div key={dayIndex} className="w-3 h-3" />
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
                    className={cn("w-3 h-3 rounded-sm", bg)}
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
