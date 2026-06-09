import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>
}) {
  // Authoritative auth lives in Server Components now (no Node middleware on
  // the Workers runtime). Bounce already-authenticated users to the app.
  const user = await getCurrentUser()
  if (user) redirect("/dashboard")

  const { redirectTo } = await searchParams
  return <LoginForm redirectTo={redirectTo} />
}
