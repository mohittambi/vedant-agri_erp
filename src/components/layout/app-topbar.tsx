import { FirmSwitcher } from "./firm-switcher"
import { UserMenu } from "./user-menu"
import { MobileNav } from "./mobile-nav"
import { NotificationsBell } from "./notifications-bell"
import type { NavGroup } from "@/lib/constants"
import type { SessionUser } from "@/lib/auth"
import { ROLE_LABELS, type RoleKey } from "@/lib/constants"

function primaryRoleLabel(user: SessionUser): string {
  if (user.isSuperAdmin) return ROLE_LABELS.SUPER_ADMIN
  const key = user.roleKeys[0] as RoleKey | undefined
  return key ? (ROLE_LABELS[key] ?? key) : "No role"
}

export function AppTopbar({
  user,
  nav,
  unreadCount,
}: {
  user: SessionUser
  nav: NavGroup[]
  unreadCount: number
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
      <MobileNav nav={nav} />
      <FirmSwitcher firms={user.firms} activeFirmId={user.activeFirmId} />
      <div className="ml-auto flex items-center gap-1">
        <NotificationsBell count={unreadCount} />
        <UserMenu
          fullName={user.fullName}
          email={user.email}
          avatarUrl={user.avatarUrl}
          roleLabel={primaryRoleLabel(user)}
        />
      </div>
    </header>
  )
}
