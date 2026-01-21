import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Hero Stats Skeleton */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-40" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex justify-center">
            <Skeleton className="h-32 w-32 rounded-full" />
          </div>
        </div>
      </div>

      {/* Goals Skeleton */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <Skeleton className="h-5 w-3/4" />
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-24" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <Skeleton className="h-5 w-2/3" />
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function GoalCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </div>
  )
}

export function HeatmapSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <Skeleton className="h-6 w-24 mb-4" />
      <div className="space-y-1">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex gap-1">
            {Array.from({ length: 12 }).map((_, j) => (
              <Skeleton key={j} className="h-3 w-3 rounded-sm" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
