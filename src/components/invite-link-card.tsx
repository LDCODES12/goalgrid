"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function InviteLinkCard({
  inviteUrl,
  inviteCode,
}: {
  inviteUrl: string
  inviteCode: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite link</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-xl border bg-background px-3 py-2">
          {inviteUrl}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleCopy} variant="secondary">
            {copied ? "Copied" : "Copy link"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Invite code: {inviteCode}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
