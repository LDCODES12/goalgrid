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
            ? "border border-rule"
            : intensity < 0.5
            ? "bg-foreground/35"
            : "bg-foreground"
        return (
          <span
            key={index}
            className={`h-3 w-3 rounded-[2px] ${bg}`}
            title={`${count} completions`}
          />
        )
      })}
    </div>
  )
}
