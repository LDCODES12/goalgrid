import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, Trophy, Zap, Users } from "lucide-react"

type WeeklySummaryData = {
  weekLabel: string
  topPerformer: { name: string; completions: number } | null
  mostImproved: { name: string; changePercent: number } | null
  groupTotal: number
  groupAverage: number
  memberSummaries: {
    memberId: string
    memberName: string
    totalCompletionsThisWeek: number
    totalCompletionsLastWeek: number
    weekOverWeekChange: number
    goals: {
      goalId: string
      goalName: string
      completionsThisWeek: number
      consistency: number
    }[]
  }[]
}

export function WeeklySummaryCard({ data }: { data: WeeklySummaryData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Weekly Summary</CardTitle>
          <Badge variant="outline" className="text-xs font-normal">
            {data.weekLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Highlights */}
        <div className="grid gap-3 sm:grid-cols-2">
          {data.topPerformer && (
            <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
                <Trophy className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Top Performer</div>
                <div className="text-sm font-medium">
                  {data.topPerformer.name}{" "}
                  <span className="text-muted-foreground">
                    ({data.topPerformer.completions})
                  </span>
                </div>
              </div>
            </div>
          )}
          {data.mostImproved && (
            <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Most Improved</div>
                <div className="text-sm font-medium">
                  {data.mostImproved.name}{" "}
                  <span className="text-emerald-500">
                    +{data.mostImproved.changePercent}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Group Stats */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Group Total</span>
          </div>
          <div className="text-sm font-medium">
            {data.groupTotal} completions
            <span className="text-muted-foreground"> (avg: {data.groupAverage})</span>
          </div>
        </div>

        {/* Member Breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="uppercase">Member Activity</span>
            <span>Check-ins this week</span>
          </div>
          <div className="divide-y rounded-lg border">
            {data.memberSummaries
              .sort((a, b) => b.totalCompletionsThisWeek - a.totalCompletionsThisWeek)
              .map((member) => {
                const maxCompletions = Math.max(...data.memberSummaries.map(m => m.totalCompletionsThisWeek), 1)
                const barPercent = (member.totalCompletionsThisWeek / maxCompletions) * 100
                
                return (
                  <div
                    key={member.memberId}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">{member.memberName}</span>
                      {member.weekOverWeekChange > 0 && member.totalCompletionsLastWeek > 0 && (
                        <span className="flex items-center text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                          {member.weekOverWeekChange}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Progress
                        value={barPercent}
                        className="h-2 w-20"
                      />
                      <span className="text-sm font-medium tabular-nums w-6 text-right">
                        {member.totalCompletionsThisWeek}
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
