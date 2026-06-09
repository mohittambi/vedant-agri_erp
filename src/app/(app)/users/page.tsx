import type { Metadata } from "next"
import { requirePermission, userHasPermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/layout/page-header"
import { UsersClient, type UserRow } from "./users-client"
import { ROLE_LABELS, type RoleKey } from "@/lib/constants"

export const metadata: Metadata = { title: "Users" }

export default async function UsersPage() {
  const { user, firmId } = await requirePermission("user:view")

  // Users that have any role in this firm.
  const userRoles = await prisma.userRole.findMany({
    where: { firmId },
    include: {
      user: { select: { id: true, fullName: true, email: true, isActive: true } },
      role: { select: { key: true } },
    },
  })

  const byUser = new Map<string, UserRow>()
  for (const ur of userRoles) {
    const existing = byUser.get(ur.user.id)
    const label = ROLE_LABELS[ur.role.key as RoleKey] ?? ur.role.key
    if (existing) existing.roles.push(label)
    else byUser.set(ur.user.id, { id: ur.user.id, fullName: ur.user.fullName, email: ur.user.email, isActive: ur.user.isActive, roles: [label] })
  }

  return (
    <>
      <PageHeader title="Users" description="People with access to this firm and their roles." />
      <UsersClient
        rows={[...byUser.values()]}
        canCreate={userHasPermission(user, "user:create")}
        canUpdate={userHasPermission(user, "user:update")}
      />
    </>
  )
}
