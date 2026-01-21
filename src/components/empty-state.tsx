import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed bg-card p-12 text-center">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-muted/30 via-transparent to-transparent pointer-events-none" />

      <div className="relative">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-muted-foreground/50"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <h3 className="mt-6 text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-sm mx-auto">{description}</p>

        {/* Action */}
        {actionHref && actionLabel ? (
          <Button
            asChild
            className="mt-6 gap-2 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <a href={actionHref}>
              <PlusCircle className="h-4 w-4" />
              {actionLabel}
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
