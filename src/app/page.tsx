import { getServerSession } from "next-auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { Button } from "@/components/ui/button"

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-lg font-semibold">GoalGrid</div>
        <div className="flex items-center gap-3">
          <Link href="/auth/signin" className="text-sm text-muted-foreground">
            Sign in
          </Link>
          <Button asChild>
            <Link href="/auth/signup">Get started</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 pb-20 pt-12">
        <section className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              Accountability, simplified
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
              A clean way to keep habits consistent with friends.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              GoalGrid makes progress visible with one-tap check-ins, weekly
              targets, and a shared group feed. No clutter, just momentum.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth/signup">Create your account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/signin">Sign in</Link>
              </Button>
            </div>
            <div className="mt-6 text-sm text-muted-foreground">
              Start solo, then invite your group when you’re ready.
            </div>
          </div>
          <div className="rounded-3xl border bg-card p-6 shadow-sm">
            <div className="space-y-4">
              <div className="rounded-2xl border bg-background p-4">
                <div className="text-sm text-muted-foreground">Today</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Lab Notes</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-600">
                    Done
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Experiments</span>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    Not yet
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <div className="text-sm text-muted-foreground">This week</div>
                <div className="mt-2 text-3xl font-semibold">86 points</div>
                <div className="mt-4 h-2 w-full rounded-full bg-muted">
                  <div className="h-2 w-3/4 rounded-full bg-primary" />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  +12 bonus for 7-day streak
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "One-tap check-ins",
              description:
                "Daily or weekly goals, same fast flow. Log progress in seconds.",
            },
            {
              title: "Group accountability",
              description:
                "See who’s on track today and keep your crew motivated.",
            },
            {
              title: "Streaks + targets",
              description:
                "Weekly targets and streaks make consistency feel rewarding.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border bg-card p-6">
              <div className="text-lg font-semibold">{item.title}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {item.description}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border bg-card p-8">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <div className="mt-6 grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
            <div className="rounded-2xl border bg-background p-4">
              <div className="text-xs uppercase text-muted-foreground">
                Step 1
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                Create goals
              </div>
              <p className="mt-2">
                Pick daily habits or weekly targets that matter.
              </p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <div className="text-xs uppercase text-muted-foreground">
                Step 2
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                Check in fast
              </div>
              <p className="mt-2">
                One tap logs your progress and keeps streaks alive.
              </p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <div className="text-xs uppercase text-muted-foreground">
                Step 3
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                Stay accountable
              </div>
              <p className="mt-2">
                Share progress with friends and keep momentum high.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border bg-card p-8 text-center">
          <h2 className="text-2xl font-semibold">
            Ready to build consistency together?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Start free, invite your friends, and build momentum this week.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/auth/signup">Get started</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/auth/signin">Sign in</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-xs text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} GoalGrid</span>
          <div className="flex items-center gap-4">
            <span>Privacy</span>
            <span>Contact</span>
            <span>Terms</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
