"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { dismissReminderAction } from "@/app/actions/reminders"
import { X } from "lucide-react"

export function DismissRemindersButton({ reminderIds }: { reminderIds: string[] }) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await Promise.all(
            reminderIds.map((id) => dismissReminderAction(id))
          )
        })
      }
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  )
}
