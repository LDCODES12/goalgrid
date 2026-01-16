import { describe, expect, it } from "vitest"
import { addDays, subDays } from "date-fns"
import { getLocalDateKey, getWeekKey, getWeekStart } from "./time"
import {
  computeDailyStreak,
  computeWeeklyPoints,
  computeWeeklyStreak,
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
