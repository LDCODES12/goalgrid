import { format, getHours, subDays } from "date-fns"

type CheckInWithTime = {
  timestamp: Date
  localDateKey: string
}

/**
 * Analyze user's check-in patterns to find optimal reminder time
 * Returns the hour (0-23) when user is most likely to complete goals
 */
export function analyzeOptimalReminderTime(
  checkIns: CheckInWithTime[],
  fallbackHour: number = 9
): { hour: number; confidence: "high" | "medium" | "low"; pattern: string } {
  if (checkIns.length < 5) {
    return {
      hour: fallbackHour,
      confidence: "low",
      pattern: "Not enough data yet",
    }
  }

  // Only analyze last 30 days
  const thirtyDaysAgo = subDays(new Date(), 30)
  const recentCheckIns = checkIns.filter(
    (c) => c.timestamp >= thirtyDaysAgo
  )

  if (recentCheckIns.length < 5) {
    return {
      hour: fallbackHour,
      confidence: "low",
      pattern: "Not enough recent data",
    }
  }

  // Count check-ins by hour
  const hourCounts: Record<number, number> = {}
  for (const checkIn of recentCheckIns) {
    const hour = getHours(checkIn.timestamp)
    hourCounts[hour] = (hourCounts[hour] || 0) + 1
  }

  // Find the most common hour
  let maxHour = fallbackHour
  let maxCount = 0
  for (const [hour, count] of Object.entries(hourCounts)) {
    if (count > maxCount) {
      maxCount = count
      maxHour = parseInt(hour)
    }
  }

  // Calculate confidence based on consistency
  const totalCheckIns = recentCheckIns.length
  const percentAtPeakHour = maxCount / totalCheckIns

  // Determine time period pattern
  let pattern: string
  if (maxHour >= 5 && maxHour < 12) {
    pattern = "Morning person"
  } else if (maxHour >= 12 && maxHour < 17) {
    pattern = "Afternoon achiever"
  } else if (maxHour >= 17 && maxHour < 21) {
    pattern = "Evening finisher"
  } else {
    pattern = "Night owl"
  }

  // Suggest reminder 1 hour before typical completion time
  const reminderHour = maxHour > 0 ? maxHour - 1 : 23

  return {
    hour: reminderHour,
    confidence: percentAtPeakHour > 0.4 ? "high" : percentAtPeakHour > 0.2 ? "medium" : "low",
    pattern,
  }
}

/**
 * Format hour to readable time string
 */
export function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12
  return `${displayHour}:00 ${period}`
}

/**
 * Get suggested reminder times with reasoning
 */
export function getSuggestedReminderTimes(
  checkIns: CheckInWithTime[]
): {
  optimal: string
  confidence: "high" | "medium" | "low"
  pattern: string
  alternatives: string[]
} {
  const analysis = analyzeOptimalReminderTime(checkIns)

  // Format the optimal time as HH:00 for the select
  const optimalFormatted = `${String(analysis.hour).padStart(2, "0")}:00`

  // Generate alternative times
  const alternatives: string[] = []
  const morningTime = "09:00"
  const afternoonTime = "14:00"
  const eveningTime = "18:00"

  if (optimalFormatted !== morningTime) alternatives.push(morningTime)
  if (optimalFormatted !== afternoonTime) alternatives.push(afternoonTime)
  if (optimalFormatted !== eveningTime) alternatives.push(eveningTime)

  return {
    optimal: optimalFormatted,
    confidence: analysis.confidence,
    pattern: analysis.pattern,
    alternatives: alternatives.slice(0, 2),
  }
}
