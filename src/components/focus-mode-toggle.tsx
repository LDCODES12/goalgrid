"use client"

import { useEffect, useState } from "react"
import { Switch } from "@/components/ui/switch"

export function FocusModeToggle({ targetId }: { targetId: string }) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target) return
    target.setAttribute("data-focus", enabled ? "on" : "off")
  }, [enabled, targetId])

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      Focus mode
      <Switch checked={enabled} onCheckedChange={setEnabled} />
    </label>
  )
}
