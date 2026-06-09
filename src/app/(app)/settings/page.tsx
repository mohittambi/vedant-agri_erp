import type { Metadata } from "next"
import { requirePermission, userHasPermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/layout/page-header"
import { SettingsForm } from "./settings-form"
import type { SettingsInput } from "@/lib/validations/settings"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const { user, firmId } = await requirePermission("settings:view")
  const s = await prisma.setting.findUnique({ where: { firmId } })

  const defaults: SettingsInput = {
    invoicePrefix: s?.invoicePrefix ?? "INV",
    purchasePrefix: s?.purchasePrefix ?? "PUR",
    voucherPrefix: s?.voucherPrefix ?? "VCH",
    financialYear: s?.financialYear ?? "",
    expiryAlertDays: s?.expiryAlertDays ?? 90,
    lowStockEnabled: s?.lowStockEnabled ?? true,
    invoiceTerms: s?.invoiceTerms ?? "",
  }

  return (
    <>
      <PageHeader title="Settings" description="Firm-level preferences for numbering, alerts and invoices." />
      <SettingsForm defaults={defaults} canEdit={userHasPermission(user, "settings:update")} />
    </>
  )
}
