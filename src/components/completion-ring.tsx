export function CompletionRing({
  value,
  label,
}: {
  value: number
  label: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  // Full weeks earn the success color; anything in progress stays on brand.
  const track = clamped >= 100 ? "var(--success)" : "var(--primary)"

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex h-32 w-32 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${track} ${clamped}%, color-mix(in oklab, var(--muted) 100%, transparent) 0)`,
        }}
        role="img"
        aria-label={`${label}: ${clamped} percent`}
      >
        <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full bg-card">
          <span className="font-display tabular text-3xl font-semibold leading-none">
            {clamped}
            <span className="text-lg">%</span>
          </span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
