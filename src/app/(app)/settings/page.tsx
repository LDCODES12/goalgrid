import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { subDays } from "date-fns"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getSuggestedReminderTimes } from "@/lib/smart-timing"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SettingsForm } from "@/components/settings-form"

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/auth/signin")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) redirect("/auth/signin")

  // Fetch check-ins for smart timing analysis
  const checkIns = await prisma.checkIn.findMany({
    where: {
      userId: user.id,
      timestamp: { gte: subDays(new Date(), 30) },
    },
    select: { timestamp: true, localDateKey: true },
    orderBy: { timestamp: "desc" },
  })

  const smartTiming = getSuggestedReminderTimes(checkIns)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Keep your profile and preferences up to date.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Name:</span> {user.name}
          </div>
          <div>
            <span className="text-muted-foreground">Email:</span> {user.email}
          </div>
        </CardContent>
      </Card>

      <SettingsForm
        currentTimezone={user.timezone}
        reminderTime={user.reminderTime}
        reminderFrequency={user.reminderFrequency as "DAILY" | "WEEKDAYS"}
        smartTiming={smartTiming}
      />

      <Card>
        <CardHeader>
          <CardTitle>How Points Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Points reward consistency, not gaming. Each week, you can earn up to <span className="font-medium text-foreground">1,000 points</span> across all your goals.
          </p>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-foreground">•</span>
              <span><span className="font-medium text-foreground">Fair sharing:</span> Points are divided among your active goals based on effort—a goal done 3x/day earns more share than 1x/day.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-foreground">•</span>
              <span><span className="font-medium text-foreground">Finish-weighted:</span> Completing a goal fully earns more than getting halfway. Consistency compounds.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-foreground">•</span>
              <span><span className="font-medium text-foreground">Streak bonus:</span> Maintaining a streak for weeks adds up to 10% bonus points.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-foreground">•</span>
              <span><span className="font-medium text-foreground">No farming:</span> The weekly ceiling prevents point inflation—focus on doing well, not doing more.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data export</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Export tools are coming soon. For now, reach out to support for a data
          extract.
        </CardContent>
      </Card>
    </div>
  )
}
