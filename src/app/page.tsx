import { getServerSession } from "next-auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { 
  CheckCircle2, 
  Users, 
  TrendingUp, 
  Zap, 
  Shield, 
  BarChart3,
  ArrowRight,
  Sparkles
} from "lucide-react"

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold">GoalGrid</div>
          <div className="flex items-center gap-3">
            <Link 
              href="/auth/signin" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link href="/auth/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
          
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-20 pt-20 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-1.5 text-sm backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-muted-foreground">Built for consistency, not perfection</span>
            </div>
            
            <h1 className="mt-8 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Build habits that
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> actually stick</span>
            </h1>
            
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              GoalGrid uses science-backed accountability to help you and your friends 
              stay consistent. No guilt trips—just progress you can see.
            </p>
            
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="gap-2">
                <Link href="/auth/signup">
                  Start for free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/signin">Sign in</Link>
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              No credit card required. Set up in 30 seconds.
            </p>

            {/* App Preview */}
            <div className="mt-16 w-full max-w-4xl">
              <div className="rounded-2xl border bg-card p-2 shadow-2xl shadow-primary/5">
                <div className="rounded-xl border bg-background p-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Left: Goals */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Today&apos;s Goals</span>
                        <span className="text-xs text-muted-foreground">2 of 3 done</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20 p-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-sm font-medium">Morning workout</span>
                          <span className="ml-auto text-xs text-emerald-600">+10 pts</span>
                        </div>
                        
                        <div className="flex items-center gap-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20 p-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-sm font-medium">Read 20 pages</span>
                          <span className="ml-auto text-xs text-emerald-600">+10 pts</span>
                        </div>
                        
                        <div className="flex items-center gap-3 rounded-lg border p-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30" />
                          <span className="text-sm text-muted-foreground">Meditation</span>
                          <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs">
                            Complete
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Right: Stats */}
                    <div className="space-y-4">
                      <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                        <div className="text-sm text-muted-foreground">This week</div>
                        <div className="mt-1 text-3xl font-bold">142 pts</div>
                        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
                          <TrendingUp className="h-4 w-4" />
                          <span>+23% vs last week</span>
                        </div>
                      </div>
                      
                      <div className="rounded-xl border p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Consistency</span>
                          <span className="text-lg font-semibold">87%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted">
                          <div className="h-2 w-[87%] rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          26 of 30 days this month
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold">Everything you need to stay on track</h2>
              <p className="mt-3 text-muted-foreground">
                Simple tools that work together to build lasting habits.
              </p>
            </div>
            
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Zap,
                  title: "One-tap check-ins",
                  description: "Log progress in seconds. No friction means you'll actually use it.",
                  color: "text-amber-500 bg-amber-500/10",
                },
                {
                  icon: Users,
                  title: "Group accountability",
                  description: "See your friends' progress in real-time. Gentle nudges, not pressure.",
                  color: "text-blue-500 bg-blue-500/10",
                },
                {
                  icon: Shield,
                  title: "Graceful streaks",
                  description: "Miss a day? Your streak survives. We focus on consistency, not perfection.",
                  color: "text-emerald-500 bg-emerald-500/10",
                },
                {
                  icon: BarChart3,
                  title: "Consistency tracking",
                  description: "See your monthly heatmap and long-term trends at a glance.",
                  color: "text-purple-500 bg-purple-500/10",
                },
                {
                  icon: TrendingUp,
                  title: "Weekly summaries",
                  description: "Celebrate wins with your group. Top performers and most improved.",
                  color: "text-rose-500 bg-rose-500/10",
                },
                {
                  icon: Sparkles,
                  title: "Smart reminders",
                  description: "Get notified at the right time based on when you usually complete goals.",
                  color: "text-cyan-500 bg-cyan-500/10",
                },
              ].map((feature) => (
                <div 
                  key={feature.title} 
                  className="group rounded-2xl border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
                >
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${feature.color}`}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold">Get started in minutes</h2>
              <p className="mt-3 text-muted-foreground">
                Three simple steps to better habits.
              </p>
            </div>
            
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Create your goals",
                  description: "Daily habits or weekly targets—you choose what works for you.",
                },
                {
                  step: "02",
                  title: "Invite your crew",
                  description: "Share a link and build your accountability group in seconds.",
                },
                {
                  step: "03",
                  title: "Build momentum",
                  description: "Check in daily, watch your consistency grow, and celebrate together.",
                },
              ].map((item, i) => (
                <div key={item.step} className="relative">
                  {i < 2 && (
                    <div className="absolute left-1/2 top-8 hidden h-px w-full bg-gradient-to-r from-border to-transparent md:block" />
                  )}
                  <div className="relative rounded-2xl border bg-card p-6 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                      {item.step}
                    </div>
                    <h3 className="mt-4 font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <div className="inline-flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div 
                  key={i} 
                  className="h-8 w-8 rounded-full border-2 border-background bg-gradient-to-br from-primary/80 to-primary"
                  style={{ marginLeft: i > 1 ? "-8px" : 0 }}
                />
              ))}
              <span className="ml-3 text-sm text-muted-foreground">
                Join hundreds building better habits
              </span>
            </div>
            
            <blockquote className="mt-8 text-xl font-medium">
              &quot;Finally, an app that doesn&apos;t make me feel guilty for missing a day. 
              The focus on consistency over perfection is a game-changer.&quot;
            </blockquote>
            <div className="mt-4 text-sm text-muted-foreground">
              — Someone who used to break every streak
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-4xl px-6">
            <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-8 text-center text-primary-foreground md:p-12">
              <h2 className="text-3xl font-bold">Ready to build habits that last?</h2>
              <p className="mt-3 text-primary-foreground/80">
                Start free today. No credit card, no commitment, no guilt.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button asChild size="lg" variant="secondary" className="gap-2">
                  <Link href="/auth/signup">
                    Create your account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} GoalGrid</span>
          <div className="flex items-center gap-6">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
