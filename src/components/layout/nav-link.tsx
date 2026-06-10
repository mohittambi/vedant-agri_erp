"use client"

import Link from "next/link"
import { useLinkStatus } from "next/link"
import { Loader2 } from "lucide-react"
import { Icon } from "./icon"
import { cn } from "@/lib/utils"

/**
 * Shows a spinner in place of the item's icon while navigation to this link is
 * pending. For prefetched/static routes the pending phase is skipped (instant),
 * so this only appears when a transition is actually waiting on the server.
 */
function PendingIcon({ name }: { name: string }) {
  const { pending } = useLinkStatus()
  return pending ? (
    <Loader2 className="size-4 shrink-0 animate-spin" />
  ) : (
    <Icon name={name} className="size-4 shrink-0" />
  )
}

export function NavLink({
  href,
  icon,
  title,
  active,
  onNavigate,
  className,
}: {
  href: string
  icon: string
  title: string
  active: boolean
  onNavigate?: () => void
  className?: string
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        className
      )}
    >
      <PendingIcon name={icon} />
      {title}
    </Link>
  )
}
