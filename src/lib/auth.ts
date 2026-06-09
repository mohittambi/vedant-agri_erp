import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { ROLES, type Permission } from "@/lib/constants"

export const ACTIVE_FIRM_COOKIE = "active_firm_id"

export type SessionFirm = { id: string; name: string }

export type SessionUser = {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  isSuperAdmin: boolean
  activeFirmId: string | null
  firms: SessionFirm[]
  roleKeys: string[]
  permissions: Set<Permission>
}

/**
 * Resolve the fully-hydrated session user for the current request.
 * Cached per-request via React `cache()` so repeated calls in a single
 * render/action hit the DB only once. Returns null when unauthenticated.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: {
      userRoles: {
        include: {
          firm: { select: { id: true, name: true, isActive: true } },
          role: {
            include: {
              rolePermissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  })

  if (!user || !user.isActive) return null

  // Firms the user can access (super admin sees all active firms).
  let firms: SessionFirm[]
  if (user.isSuperAdmin) {
    firms = await prisma.firm.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  } else {
    const map = new Map<string, SessionFirm>()
    for (const ur of user.userRoles) {
      if (ur.firm.isActive) map.set(ur.firm.id, { id: ur.firm.id, name: ur.firm.name })
    }
    firms = [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  // Determine the active firm from the cookie, falling back to default/first.
  const cookieStore = await cookies()
  const cookieFirm = cookieStore.get(ACTIVE_FIRM_COOKIE)?.value
  const validCookieFirm = firms.find((f) => f.id === cookieFirm)?.id
  const activeFirmId =
    validCookieFirm ??
    (user.defaultFirmId && firms.some((f) => f.id === user.defaultFirmId)
      ? user.defaultFirmId
      : (firms[0]?.id ?? null))

  // Aggregate permissions + role keys for the ACTIVE firm only.
  const permissions = new Set<Permission>()
  const roleKeys = new Set<string>()
  for (const ur of user.userRoles) {
    if (ur.firmId !== activeFirmId) continue
    roleKeys.add(ur.role.key)
    for (const rp of ur.role.rolePermissions) {
      permissions.add(rp.permission.key as Permission)
    }
  }

  if (user.isSuperAdmin) roleKeys.add(ROLES.SUPER_ADMIN)

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    isSuperAdmin: user.isSuperAdmin,
    activeFirmId,
    firms,
    roleKeys: [...roleKeys],
    permissions,
  }
})

/** Redirects to /login when there is no session. */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
}

/** Authenticated user + a guaranteed active firm id. */
export async function requireFirm(): Promise<{ user: SessionUser; firmId: string }> {
  const user = await requireAuth()
  if (!user.activeFirmId) redirect("/onboarding")
  return { user, firmId: user.activeFirmId }
}

export function userHasPermission(user: SessionUser, permission: Permission): boolean {
  return user.isSuperAdmin || user.permissions.has(permission)
}

/**
 * Authoritative permission gate for pages and server actions.
 * Throws (server action) or you can pre-check with `userHasPermission`.
 */
export async function requirePermission(
  permission: Permission
): Promise<{ user: SessionUser; firmId: string }> {
  const { user, firmId } = await requireFirm()
  if (!userHasPermission(user, permission)) {
    throw new Error(`Forbidden: missing permission "${permission}"`)
  }
  return { user, firmId }
}
