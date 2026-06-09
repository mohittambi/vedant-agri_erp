import Link from "next/link"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"

export function NotificationsBell({ count }: { count: number }) {
  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link href="/notifications" aria-label="Notifications">
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>
    </Button>
  )
}
