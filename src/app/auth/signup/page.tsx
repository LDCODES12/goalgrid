"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signUpAction } from "@/app/actions/auth"

export default function SignUpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  
  // Get callback URL from query params (for invite links, etc.)
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setIsLoading(true)
    const result = await signUpAction(formData)
    if (!result.ok) {
      setIsLoading(false)
      toast.error(result.error ?? "Could not create account.")
      return
    }
    const signInResult = await signIn("credentials", {
      redirect: false,
      email: formData.get("email"),
      password: formData.get("password"),
    })
    setIsLoading(false)
    if (signInResult?.error) {
      toast.error("Account created. Please sign in.")
      router.push("/auth/signin")
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Join GoalGrid and start tracking together.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" type="text" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">
              Minimum 8 characters.
            </p>
          </div>
          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link 
            href={callbackUrl !== "/dashboard" 
              ? `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}` 
              : "/auth/signin"
            } 
            className="text-foreground underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
