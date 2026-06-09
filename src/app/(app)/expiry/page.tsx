import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber, daysUntil } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { BatchTable, type BatchRow } from "@/components/inventory/batch-table"
import { StatCard } from "@/components/dashboard/stat-card"

export const metadata: Metadata = { title: "Expiry Tracking" }

export default async function ExpiryPage() {
  const { firmId } = await requirePermission("batch:view")
  const now = new Date()

  const batches = await prisma.inventoryBatch.findMany({
    where: { firmId, quantity: { gt: 0 }, expiryDate: { not: null } },
    orderBy: { expiryDate: "asc" },
    include: { product: { select: { name: true, sku: true } }, location: { select: { name: true } } },
    take: 500,
  })

  const rows: BatchRow[] = batches.map((b) => {
    const qty = toNumber(b.quantity)
    return {
      id: b.id,
      product: b.product.name,
      sku: b.product.sku,
      location: b.location.name,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate!.toISOString(),
      daysToExpiry: daysUntil(b.expiryDate!),
      quantity: qty,
      purchaseRate: toNumber(b.purchaseRate),
      value: qty * toNumber(b.purchaseRate),
    }
  })

  const expired = rows.filter((r) => (r.daysToExpiry ?? 0) < 0)
  const soon = rows.filter((r) => (r.daysToExpiry ?? 999) >= 0 && (r.daysToExpiry ?? 999) <= 30)
  void now

  return (
    <>
      <PageHeader title="Expiry tracking" description="Expired stock cannot be sold. Clear near-expiry batches first." />
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Expired batches" value={String(expired.length)} icon="CalendarClock" tone="danger" />
        <StatCard label="Expiring ≤ 30 days" value={String(soon.length)} icon="CalendarClock" tone="warning" />
        <StatCard label="Tracked batches" value={String(rows.length)} icon="Layers" />
      </div>
      <BatchTable rows={rows} />
    </>
  )
}
