"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateReminderAction, updateTimezoneAction, updateNicknameAction } from "@/app/actions/settings"
import { leaveGroupAction } from "@/app/actions/groups"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"

const timezones = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
]

const reminderTimes = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "12:00",
  "15:00",
  "18:00",
  "20:00",
]

type SmartTiming = {
  optimal: string
  confidence: "high" | "medium" | "low"
  pattern: string
  alternatives: string[]
}

export function SettingsForm({
  currentTimezone,
  reminderTime,
  reminderFrequency,
  smartTiming,
  nickname,
}: {
  currentTimezone: string
  reminderTime: string
  reminderFrequency: "DAILY" | "WEEKDAYS"
  smartTiming?: SmartTiming
  nickname?: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [nicknameValue, setNicknameValue] = useState(nickname ?? "")
  const router = useRouter()

  const handleTimezone = (value: string) => {
    const formData = new FormData()
    formData.set("timezone", value)
    startTransition(async () => {
      const result = await updateTimezoneAction(formData)
      if (!result.ok) {
        toast.error(result.error ?? "Could not update timezone.")
        return
      }
      toast.success("Timezone updated.")
      router.refresh()
    })
  }

  const handleNickname = () => {
    const formData = new FormData()
    formData.set("nickname", nicknameValue)
    startTransition(async () => {
      const result = await updateNicknameAction(formData)
      if (!result.ok) {
        toast.error(result.error ?? "Could not update nickname.")
        return
      }
      toast.success("Nickname updated.")
      router.refresh()
    })
  }

  const handleLeaveGroup = () => {
    startTransition(async () => {
      const result = await leaveGroupAction()
      if (!result.ok) {
        toast.error(result.error ?? "Could not leave group.")
        return
      }
      toast.success("You left the group.")
      router.refresh()
    })
  }

  const handleReminderUpdate = (next: {
    reminderTime: string
    reminderFrequency: "DAILY" | "WEEKDAYS"
  }) => {
    const formData = new FormData()
    formData.set("reminderTime", next.reminderTime)
    formData.set("reminderFrequency", next.reminderFrequency)
    startTransition(async () => {
      const result = await updateReminderAction(formData)
      if (!result.ok) {
        toast.error(result.error ?? "Could not update reminder settings.")
        return
      }
      toast.success("Reminder settings updated.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Nickname</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Set a display name that your group members will see instead of your full name.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Enter nickname (optional)"
              value={nicknameValue}
              onChange={(e) => setNicknameValue(e.target.value)}
              maxLength={30}
              className="max-w-xs"
            />
            <Button 
              onClick={handleNickname} 
              disabled={isPending || nicknameValue === (nickname ?? "")}
              variant="outline"
            >
              Save
            </Button>
          </div>
          {nicknameValue && (
            <p className="text-xs text-muted-foreground">
              Group members will see: <span className="font-medium text-foreground">{nicknameValue}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timezone</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={currentTimezone} onValueChange={handleTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timezones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {/* Smart Timing Suggestion */}
          {smartTiming && smartTiming.confidence !== "low" && reminderTime !== smartTiming.optimal && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Smart suggestion: {smartTiming.optimal}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Based on your pattern: {smartTiming.pattern} ({smartTiming.confidence} confidence)
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleReminderUpdate({
                      reminderTime: smartTiming.optimal,
                      reminderFrequency,
                    })
                  }
                  disabled={isPending}
                >
                  Apply
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 text-xs uppercase text-muted-foreground">
                Reminder time
              </div>
              <Select
                value={reminderTime}
                onValueChange={(value) =>
                  handleReminderUpdate({
                    reminderTime: value,
                    reminderFrequency,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reminderTimes.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase text-muted-foreground">
                Frequency
              </div>
              <Select
                value={reminderFrequency}
                onValueChange={(value) =>
                  handleReminderUpdate({
                    reminderTime,
                    reminderFrequency: value as "DAILY" | "WEEKDAYS",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKDAYS">Weekdays</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2">
            <span>Push notifications (coming soon)</span>
            <Switch disabled />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Group membership</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Leave your current group. This won’t delete your account.</p>
          <Button
            variant="destructive"
            onClick={handleLeaveGroup}
            disabled={isPending}
          >
            Leave group
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
