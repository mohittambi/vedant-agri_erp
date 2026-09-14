"use client"

import { usePathname } from "next/navigation"
import { Sprout } from "lucide-react"
import { NavLink } from "./nav-link"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { NavGroup } from "@/lib/constants"

export function AppSidebar({ nav }: { nav: NavGroup[] }) {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sprout className="size-4" />
        </div>
        <span className="font-semibold tracking-tight">Agri ERP</span>
      </div>

      {/* min-h-0 so the nav scrolls inside the fixed-height sidebar instead of
          stretching it past the viewport. */}
      <ScrollArea className="min-h-0 flex-1 px-2 py-3">
        <nav className="flex flex-col gap-4">
          {nav.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/")
                  return (
                    <li key={item.href}>
                      <NavLink
                        href={item.href}
                        icon={item.icon}
                        title={item.title}
                        active={active}
                      />
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  )
}
