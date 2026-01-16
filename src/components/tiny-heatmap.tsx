import { cn } from "@/lib/utils"

export function TinyHeatmap({
  counts,
  className,
}: {
  counts: number[]
  className?: string
}) {
  const max = Math.max(1, ...counts)
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {counts.map((count, index) => {
        const intensity = count / max
        const bg =
          intensity === 0
            ? "bg-muted"
            : intensity < 0.5
            ? "bg-primary/40"
            : "bg-primary"
        return (
          <span
            key={index}
            className={`h-3 w-3 rounded ${bg}`}
            title={`${count} completions`}
          />
        )
      })}
    </div>
  )
}
