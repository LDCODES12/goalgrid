import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { joinGroupByCodeAction } from "@/app/actions/groups"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default async function GroupJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const session = await getServerSession(authOptions)
  const params = await searchParams
  
  if (!session?.user?.id) {
    // Store the invite code in the redirect URL so user can join after signin
    const redirectUrl = params.code 
      ? `/group/join?code=${params.code}` 
      : "/group"
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(redirectUrl)}`)
  }

  const inviteCode = params.code
  if (!inviteCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid invite link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This invite link is missing a code. Please ask for a new invite link.
            </p>
            <Link 
              href="/group" 
              className="inline-block text-sm text-primary hover:underline"
            >
              Go to your group →
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const result = await joinGroupByCodeAction(inviteCode)
  if (!result.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Could not join group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {result.error ?? "Something went wrong. Try again or request a new invite link."}
            </p>
            <Link 
              href="/group" 
              className="inline-block text-sm text-primary hover:underline"
            >
              Go to your group →
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  redirect("/group")
}
