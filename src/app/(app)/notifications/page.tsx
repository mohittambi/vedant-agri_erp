import type { Metadata } from "next"
import { requireFirm } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/layout/page-header"
import { NotificationsClient, type NotificationRow } from "./notifications-client"

export const metadata: Metadata = { title: "Notifications" }

export default async function NotificationsPage() {
  const { user, firmId } = await requireFirm()
  const notifications = await prisma.notification.findMany({
    where: { firmId, OR: [{ userId: null }, { userId: user.id }] },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  const rows: NotificationRow[] = notifications.map((n) => ({
    id: n.id, type: n.type, title: n.title, message: n.message, isRead: n.isRead, createdAt: n.createdAt.toISOString(),
  }))
  return (
    <>
      <PageHeader title="Notifications" description="Low-stock, expiry and payment alerts." />
      <NotificationsClient rows={rows} />
    </>
  )
}
