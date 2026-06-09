import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ROLE_LABELS, type RoleKey } from "@/lib/constants"

export const metadata: Metadata = { title: "Roles" }

export default async function RolesPage() {
  const { firmId } = await requirePermission("role:view")

  const roles = await prisma.role.findMany({
    where: { OR: [{ firmId: null }, { firmId }] },
    include: { rolePermissions: { include: { permission: { select: { resource: true } } } } },
    orderBy: { name: "asc" },
  })

  return (
    <>
      <PageHeader title="Roles" description="Role-based access control. System roles ship with a sensible permission matrix." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => {
          const resources = [...new Set(role.rolePermissions.map((rp) => rp.permission.resource))].sort()
          const label = ROLE_LABELS[role.key as RoleKey] ?? role.name
          return (
            <Card key={role.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">{label}</CardTitle>
                {role.isSystem && <Badge variant="outline" className="text-muted-foreground">System</Badge>}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{role.rolePermissions.length} permissions across {resources.length} modules</p>
                <div className="flex flex-wrap gap-1">
                  {resources.slice(0, 14).map((r) => (
                    <Badge key={r} variant="secondary" className="text-xs">{r.replace("_", " ")}</Badge>
                  ))}
                  {resources.length > 14 && <Badge variant="secondary" className="text-xs">+{resources.length - 14}</Badge>}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
