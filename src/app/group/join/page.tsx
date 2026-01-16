import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { joinGroupByCodeAction } from "@/app/actions/groups"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function GroupJoinPage({
  searchParams,
}: {
  searchParams: { code?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  const inviteCode = searchParams.code
  if (!inviteCode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invite link invalid</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This invite link is missing a code.
        </CardContent>
      </Card>
    )
  }

  const result = await joinGroupByCodeAction(inviteCode)
  if (!result.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not join group</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {result.error ?? "Try again or request a new invite link."}
        </CardContent>
      </Card>
    )
  }

  redirect("/group")
}
