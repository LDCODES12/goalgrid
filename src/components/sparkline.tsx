import { cn } from "@/lib/utils"

export function Sparkline({
  values,
  className,
}: {
  values: number[]
  className?: string
}) {
  const max = Math.max(1, ...values)
  return (
    <div className={cn("flex items-end gap-1", className)}>
      {values.map((value, index) => (
        <span
          key={index}
          className="w-2 rounded-[1px] bg-foreground/45"
          style={{ height: `${Math.max(3, (value / max) * 24)}px` }}
        />
      ))}
    </div>
  )
}
