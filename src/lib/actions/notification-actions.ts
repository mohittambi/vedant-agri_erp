"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireFirm } from "@/lib/auth"

export async function markAllNotificationsRead() {
  const { user, firmId } = await requireFirm()
  await prisma.notification.updateMany({
    where: { firmId, isRead: false, OR: [{ userId: null }, { userId: user.id }] },
    data: { isRead: true },
  })
  revalidatePath("/notifications")
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function markNotificationRead(id: string) {
  const { firmId } = await requireFirm()
  await prisma.notification.updateMany({ where: { id, firmId }, data: { isRead: true } })
  revalidatePath("/notifications")
  revalidatePath("/", "layout")
  return { ok: true }
}
