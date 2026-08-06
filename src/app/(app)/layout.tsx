import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getWeekKey, getLocalDateKey } from "@/lib/time"
import { milliToDisplay } from "@/lib/points"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"
import { NavLink } from "@/components/nav-link"
import { DynamicFavicon } from "@/components/dynamic-favicon"
import { subDays } from "date-fns"

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/group", label: "Group" },
  { href: "/goals", label: "Goals" },
  { href: "/settings", label: "Settings" },
]

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/auth/signin")
  }

  // Fetch user data for dynamic favicon
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      timezone: true,
      pointsWeekMilli: true,
      pointsWeekKey: true,
    },
  })

  const timezone = user?.timezone ?? "America/Chicago"
  const now = new Date()
  const currentWeekKey = getWeekKey(now, timezone)
  
  // Get weekly points (check if the stored week key matches current week)
  const weeklyPoints = user?.pointsWeekKey === currentWeekKey 
    ? milliToDisplay(user?.pointsWeekMilli ?? 0)
    : 0

  // Calculate weekly completion percentage
  const goals = await prisma.goal.findMany({
    where: { ownerId: session.user.id, active: true },
    select: {
      id: true,
      cadenceType: true,
      dailyTarget: true,
      weeklyTarget: true,
      checkIns: {
        where: { weekKey: currentWeekKey, userId: session.user.id },
        select: { id: true },
      },
    },
  })

  let totalTarget = 0
  let totalDone = 0

  for (const goal of goals) {
    if (goal.cadenceType === "WEEKLY") {
      totalTarget += goal.weeklyTarget ?? 1
      totalDone += Math.min(goal.checkIns.length, goal.weeklyTarget ?? 1)
    } else {
      // Daily goals: target is dailyTarget * 7 per week
      const dailyTarget = goal.dailyTarget ?? 1
      totalTarget += dailyTarget * 7
      totalDone += Math.min(goal.checkIns.length, dailyTarget * 7)
    }
  }

  const completionPercent = totalTarget > 0 
    ? Math.round((totalDone / totalTarget) * 100)
    : 0

  return (
    <div className="min-h-screen bg-background">
      <DynamicFavicon completionPercent={completionPercent} points={weeklyPoints} />
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="font-display text-lg font-semibold tracking-tight transition-opacity hover:opacity-70"
            >
              Anchor
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="flex items-center justify-center gap-1 border-t border-border/70 px-4 py-2 sm:hidden">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  )
}
