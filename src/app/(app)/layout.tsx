import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NAV, type NavGroup } from "@/lib/constants"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppTopbar } from "@/components/layout/app-topbar"
import type { SessionUser } from "@/lib/auth"

/** Filter the navigation tree down to what this user is allowed to see. */
function visibleNav(user: SessionUser): NavGroup[] {
  return NAV.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => {
      if (item.superAdminOnly && !user.isSuperAdmin) return false
      if (!item.permission) return true
      return user.isSuperAdmin || user.permissions.has(item.permission)
    }),
  })).filter((group) => group.items.length > 0)
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()
  const nav = visibleNav(user)

  const unreadCount = user.activeFirmId
    ? await prisma.notification.count({
        where: {
          firmId: user.activeFirmId,
          isRead: false,
          OR: [{ userId: null }, { userId: user.id }],
        },
      })
    : 0

  return (
    <div className="flex flex-1">
      <AppSidebar nav={nav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar user={user} nav={nav} unreadCount={unreadCount} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
