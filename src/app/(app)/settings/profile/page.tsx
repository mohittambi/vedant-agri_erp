import type { Metadata } from "next"
import { requireAuth } from "@/lib/auth"
import { ROLE_LABELS, type RoleKey } from "@/lib/constants"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { initials } from "@/lib/format"

export const metadata: Metadata = { title: "Profile" }

export default async function ProfilePage() {
  const user = await requireAuth()
  const roleLabels = user.isSuperAdmin
    ? [ROLE_LABELS.SUPER_ADMIN]
    : user.roleKeys.map((k) => ROLE_LABELS[k as RoleKey] ?? k)

  return (
    <>
      <PageHeader title="My profile" description="Your account details." />
      <Card className="max-w-xl">
        <CardContent className="flex items-center gap-4 py-6">
          <Avatar className="size-16"><AvatarFallback className="text-lg">{initials(user.fullName)}</AvatarFallback></Avatar>
          <div className="space-y-1">
            <p className="text-lg font-semibold">{user.fullName}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {roleLabels.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
