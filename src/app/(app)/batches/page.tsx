import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber, daysUntil } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { BatchTable, type BatchRow } from "@/components/inventory/batch-table"

export const metadata: Metadata = { title: "Batches" }

export default async function BatchesPage() {
  const { firmId } = await requirePermission("batch:view")
  const batches = await prisma.inventoryBatch.findMany({
    where: { firmId },
    orderBy: [{ receivedAt: "asc" }],
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
      expiryDate: b.expiryDate?.toISOString() ?? null,
      daysToExpiry: b.expiryDate ? daysUntil(b.expiryDate) : null,
      quantity: qty,
      purchaseRate: toNumber(b.purchaseRate),
      value: qty * toNumber(b.purchaseRate),
    }
  })

  return (
    <>
      <PageHeader title="Batches" description="Every stock batch (oldest first = FIFO consumption order)." />
      <BatchTable rows={rows} />
    </>
  )
}
