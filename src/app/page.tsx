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
      <header className="fixed top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(10, 10)">
                  <circle cx="0" cy="-4" r="1.5" fill="none" stroke="white" strokeWidth="1.2"/>
                  <rect x="-0.6" y="-2.5" width="1.2" height="8" rx="0.6" fill="white"/>
                  <g transform="translate(0, 5.5)">
                    <path d="M -3 -1.2 Q -3 -0.6, -2.7 0 L -1.5 1.2 Q -1.2 1.5, -0.9 1.2 L 0 0.6" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                    <path d="M 3 -1.2 Q 3 -0.6, 2.7 0 L 1.5 1.2 Q 1.2 1.5, 0.9 1.2 L 0 0.6" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="-3" y1="-1.2" x2="3" y2="-1.2" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                  </g>
                </g>
              </svg>
            </div>
            <span className="text-lg font-semibold">Anchor</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              Sign in
            </Link>
            <Button asChild size="sm" className="shadow-sm hover:shadow-md transition-shadow duration-200">
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
            
            <h1 className="mt-8 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl leading-[1.1]">
              Build habits that
              <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 bg-clip-text text-transparent"> actually stick</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Anchor uses science-backed accountability to help you and your friends
              stay consistent. No guilt trips—just progress you can see.
            </p>
            
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105"
              >
                <Link href="/auth/signup">
                  Start for free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="hover:bg-muted/50 transition-all duration-200"
              >
                <Link href="/auth/signin">Sign in</Link>
              </Button>
            </div>

            <p className="mt-5 text-sm text-muted-foreground/80">
              No credit card required • Set up in 30 seconds
            </p>

            {/* App Preview */}
            <div className="mt-16 w-full max-w-4xl">
              <div className="rounded-2xl border bg-card p-2 shadow-2xl shadow-emerald-500/5 ring-1 ring-emerald-500/10">
                <div className="rounded-xl border bg-background p-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
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
        <section className="border-t bg-muted/30 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-1.5 text-sm backdrop-blur-sm mb-6">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">Features</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to stay on track</h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Simple, powerful tools that work together to build lasting habits.
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
                  className="group relative rounded-2xl border bg-card p-6 transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-1"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/0 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <div className="relative">
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color} transition-transform duration-300 group-hover:scale-110`}>
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-semibold text-lg">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                  </div>
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
        <section className="py-24">
          <div className="mx-auto max-w-4xl px-6">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-400 p-8 text-center text-white shadow-2xl shadow-emerald-500/20 md:p-12">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
              <div className="relative">
                <h2 className="text-3xl font-bold sm:text-4xl">Ready to build habits that last?</h2>
                <p className="mt-4 text-lg text-emerald-50">
                  Start free today. No credit card, no commitment, no guilt.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  <Button
                    asChild
                    size="lg"
                    variant="secondary"
                    className="gap-2 bg-white text-emerald-600 hover:bg-white/90 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                  >
                    <Link href="/auth/signup">
                      Create your account
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/20 py-12">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g transform="translate(10, 10)">
                    <circle cx="0" cy="-4" r="1.5" fill="none" stroke="white" strokeWidth="1.2"/>
                    <rect x="-0.6" y="-2.5" width="1.2" height="8" rx="0.6" fill="white"/>
                    <g transform="translate(0, 5.5)">
                      <path d="M -3 -1.2 Q -3 -0.6, -2.7 0 L -1.5 1.2 Q -1.2 1.5, -0.9 1.2 L 0 0.6" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                      <path d="M 3 -1.2 Q 3 -0.6, 2.7 0 L 1.5 1.2 Q 1.2 1.5, 0.9 1.2 L 0 0.6" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                      <line x1="-3" y1="-1.2" x2="3" y2="-1.2" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                    </g>
                  </g>
                </svg>
              </div>
              <span className="font-semibold">Anchor</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition-colors duration-200">Privacy</Link>
              <Link href="#" className="hover:text-foreground transition-colors duration-200">Terms</Link>
              <Link href="#" className="hover:text-foreground transition-colors duration-200">Contact</Link>
            </div>
          </div>
          <div className="mt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Anchor. Built for consistency, not perfection.
          </div>
        </div>
      </footer>
    </div>
  )
}
