"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Sprout } from "lucide-react"
import { Icon } from "./icon"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { NavGroup } from "@/lib/constants"

export function MobileNav({ nav }: { nav: NavGroup[] }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="size-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="h-14 flex-row items-center gap-2 border-b px-4">
          <Sprout className="size-5 text-primary" />
          <SheetTitle>Agri ERP</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-3.5rem)] px-2 py-3">
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
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                            active
                              ? "bg-accent font-medium text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                          )}
                        >
                          <Icon name={item.icon} className="size-4 shrink-0" />
                          {item.title}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
