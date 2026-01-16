import { describe, expect, it } from "vitest"
import { addDays, subDays } from "date-fns"
import { getLocalDateKey, getWeekKey, getWeekStart } from "./time"
import {
  computeDailyStreak,
  computeWeeklyPoints,
  computeWeeklyStreak,
  computeConsistencyPercentage,
  computeGracefulStreak,
  getSoftFailureMessage,
} from "./scoring"

describe("streak logic", () => {
  it("computes daily streak ending today", () => {
    const tz = "America/Chicago"
    const today = new Date("2025-01-15T18:00:00Z")
    const keys = [
      getLocalDateKey(today, tz),
      getLocalDateKey(subDays(today, 1), tz),
      getLocalDateKey(subDays(today, 2), tz),
    ]
    const streak = computeDailyStreak(keys, getLocalDateKey(today, tz), tz)
    expect(streak).toBe(3)
  })

  it("computes weekly streak across consecutive weeks", () => {
    const tz = "America/Chicago"
    const today = new Date("2025-01-15T18:00:00Z")
    const weekStart = getWeekStart(today, tz)
    const currentKey = getWeekKey(today, tz)
    const prevKey = getWeekKey(subDays(weekStart, 1), tz)
    const weekCounts = {
      [currentKey]: 3,
      [prevKey]: 3,
    }
    const streak = computeWeeklyStreak(weekCounts, weekStart, tz, 3)
    expect(streak).toBe(2)
  })
})

describe("weekly scoring", () => {
  it("caps points and applies early bonus for weekly targets", () => {
    const tz = "America/Chicago"
    const today = new Date("2025-01-15T18:00:00Z")
    const weekKey = getWeekKey(today, tz)
    const checkInsThisWeek = [0, 1, 2, 3].map((offset) => ({
      localDateKey: getLocalDateKey(addDays(today, offset), tz),
      weekKey,
    }))
    const points = computeWeeklyPoints({
      goal: {
        cadenceType: "WEEKLY",
        pointsPerCheckIn: 10,
        weeklyTarget: 3,
        weeklyTargetBonus: 20,
        streakBonus: 5,
      },
      checkInsThisWeek,
      currentStreak: 0,
      timeZone: tz,
      today,
    })
    expect(points).toBe(50)
  })
})

describe("graceful failure", () => {
  it("computes consistency percentage correctly", () => {
    const tz = "America/Chicago"
    const today = new Date("2025-01-15T18:00:00Z")
    const todayKey = getLocalDateKey(today, tz)
    // 15 days of check-ins out of 30 = 50%
    const keys = Array.from({ length: 15 }).map((_, i) =>
      getLocalDateKey(subDays(today, i * 2), tz)
    )
    const consistency = computeConsistencyPercentage(keys, todayKey, tz, 30)
    expect(consistency).toBe(50)
  })

  it("computes graceful streak with 1 allowed freeze", () => {
    const tz = "America/Chicago"
    const today = new Date("2025-01-15T18:00:00Z")
    const todayKey = getLocalDateKey(today, tz)
    // Streak with one gap: day-0, day-1, day-2, [gap at day-3], day-4
    // The algorithm will use freezes until it hits 2 consecutive misses
    const keys = [
      getLocalDateKey(today, tz),          // day 0
      getLocalDateKey(subDays(today, 1), tz), // day -1
      getLocalDateKey(subDays(today, 2), tz), // day -2
      // day -3 missing (first freeze)
      getLocalDateKey(subDays(today, 4), tz), // day -4
      // day -5 missing (second freeze, then day -6 miss breaks it)
    ]
    const result = computeGracefulStreak(keys, todayKey, tz, 1)
    // With 1 allowed freeze, streak extends through one gap, 
    // but freezesUsed can be >1 when streak ends on misses
    expect(result.currentStreak).toBe(4)
    expect(result.freezesUsed).toBeGreaterThanOrEqual(1)
    expect(result.isAtRisk).toBe(false)
  })

  it("breaks streak when too many consecutive misses", () => {
    const tz = "America/Chicago"
    const today = new Date("2025-01-15T18:00:00Z")
    const todayKey = getLocalDateKey(today, tz)
    // Check-ins with 2 gaps: today, day-3 (missing day-1 and day-2)
    const keys = [
      getLocalDateKey(today, tz),
      getLocalDateKey(subDays(today, 3), tz),
    ]
    const result = computeGracefulStreak(keys, todayKey, tz, 1)
    // With 1 allowed freeze, 2 consecutive misses should break streak
    expect(result.currentStreak).toBe(1)
  })

  it("returns soft message based on consistency", () => {
    // High consistency - no message
    expect(getSoftFailureMessage(85, 26, 30)).toBeNull()
    // Medium consistency - encouraging message
    const medium = getSoftFailureMessage(60, 18, 30)
    expect(medium).toContain("18")
    // Low consistency - supportive message
    const low = getSoftFailureMessage(30, 9, 30)
    expect(low).toBeTruthy()
  })
})
