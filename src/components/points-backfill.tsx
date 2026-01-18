"use client"

import { useEffect, useRef } from "react"
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
  const hasRunRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    // Only run once, and only if user has check-ins but no ledger entries
    if (hasRunRef.current || !hasCheckIns || hasLedgerEntries) return

    hasRunRef.current = true

    // Run backfill in background
    backfillUserPointsAction().then((result) => {
      if (result.ok && result.pointsAwarded && result.pointsAwarded > 0) {
        toast.success(`Welcome to points! Credited ${result.totalLifetimePoints} lifetime points for your activity.`)
        router.refresh()
      }
    }).catch(() => {
      // Silently fail - not critical
    })
  }, [hasCheckIns, hasLedgerEntries, router])

  // Invisible component
  return null
}
