import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Building2 } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = { title: "Get started" }

export default async function OnboardingPage() {
  const user = await requireAuth()
  // Already has a firm → go to the dashboard.
  if (user.activeFirmId) redirect("/dashboard")

  return (
    <div className="flex flex-1 items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="size-5" />
          </div>
          <CardTitle>Welcome to Agri Input ERP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {user.isSuperAdmin ? (
            <>
              <p>You don&apos;t have any firm yet. Create your first firm to start managing inventory, billing and accounts.</p>
              <Button asChild><Link href="/firms">Create your first firm</Link></Button>
            </>
          ) : (
            <p>Your account is not linked to any firm yet. Please ask a Super Admin to assign you a firm and role.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
