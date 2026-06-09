"use client"

import { useTransition } from "react"
import { CheckCheck, Bell } from "lucide-react"
import { toast } from "sonner"
import { markAllNotificationsRead } from "@/lib/actions/notification-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export type NotificationRow = {
  id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string
}

export function NotificationsClient({ rows }: { rows: NotificationRow[] }) {
  const [pending, startTransition] = useTransition()
  const hasUnread = rows.some((r) => !r.isRead)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={pending || !hasUnread}
          onClick={() => startTransition(async () => {
            await markAllNotificationsRead()
            toast.success("All marked as read")
          })}
        >
          <CheckCheck className="size-4" /> Mark all read
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Bell className="size-8" /> No notifications
        </CardContent></Card>
      ) : (
        rows.map((n) => (
          <Card key={n.id} className={cn(!n.isRead && "border-primary/40 bg-primary/[0.03]")}>
            <CardContent className="flex items-start justify-between gap-4 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{n.title}</span>
                  {!n.isRead && <Badge variant="secondary" className="bg-primary/10 text-primary">New</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{n.message}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
