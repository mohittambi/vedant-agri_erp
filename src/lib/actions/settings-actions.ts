"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { settingsSchema, type SettingsInput } from "@/lib/validations/settings"
import type { ActionResult } from "@/lib/actions/firm-actions"

export async function updateSettings(values: SettingsInput): Promise<ActionResult> {
  const { user, firmId } = await requirePermission("settings:update")
  const parsed = settingsSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> }
  }
  const d = parsed.data
  const data = {
    invoicePrefix: d.invoicePrefix.toUpperCase(),
    purchasePrefix: d.purchasePrefix.toUpperCase(),
    voucherPrefix: d.voucherPrefix.toUpperCase(),
    financialYear: d.financialYear || null,
    expiryAlertDays: d.expiryAlertDays,
    lowStockEnabled: d.lowStockEnabled,
    invoiceTerms: d.invoiceTerms || null,
  }
  await prisma.setting.upsert({
    where: { firmId },
    update: data,
    create: { firmId, ...data },
  })
  await logAudit({ firmId, userId: user.id, action: "UPDATE", entity: "Settings", entityId: firmId, newData: data })
  revalidatePath("/settings")
  return { ok: true }
}
