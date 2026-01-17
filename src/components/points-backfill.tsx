"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { backfillUserPointsAction } from "@/app/actions/points"

interface PointsBackfillProps {
  hasCheckIns: boolean
  hasLedgerEntries: boolean
}

/**
 * Invisible component that triggers points backfill for users
 * who have check-ins but haven't been credited points yet.
 */
export function PointsBackfill({ hasCheckIns, hasLedgerEntries }: PointsBackfillProps) {
  const [hasRun, setHasRun] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Only run once, and only if user has check-ins but no ledger entries
    if (hasRun || !hasCheckIns || hasLedgerEntries) return

    setHasRun(true)

    // Run backfill in background
    backfillUserPointsAction().then((result) => {
      if (result.ok && result.pointsAwarded && result.pointsAwarded > 0) {
        toast.success(`Welcome to points! Credited ${result.totalLifetimePoints} lifetime points for your activity.`)
        router.refresh()
      }
    }).catch(() => {
      // Silently fail - not critical
    })
  }, [hasCheckIns, hasLedgerEntries, hasRun, router])

  // Invisible component
  return null
}
