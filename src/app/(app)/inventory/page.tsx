import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { StockTable, type StockRow } from "@/components/inventory/stock-table"

export const metadata: Metadata = { title: "Stock" }

export default async function InventoryPage() {
  const { firmId } = await requirePermission("inventory:view")

  const [grouped, products, locations] = await Promise.all([
    prisma.inventoryBatch.groupBy({
      by: ["productId", "locationId"],
      where: { firmId },
      _sum: { quantity: true },
    }),
    prisma.product.findMany({ where: { firmId }, select: { id: true, name: true, sku: true, unit: true, reorderLevel: true, purchaseRate: true } }),
    prisma.location.findMany({ where: { firmId }, select: { id: true, name: true } }),
  ])

  const pMap = new Map(products.map((p) => [p.id, p]))
  const lMap = new Map(locations.map((l) => [l.id, l.name]))

  const rows: StockRow[] = grouped
    .map((g) => {
      const p = pMap.get(g.productId)
      const qty = toNumber(g._sum.quantity)
      return {
        key: `${g.productId}-${g.locationId}`,
        product: p?.name ?? "—",
        sku: p?.sku ?? "—",
        unit: p?.unit ?? "",
        location: lMap.get(g.locationId) ?? "—",
        quantity: qty,
        reorderLevel: toNumber(p?.reorderLevel),
        value: qty * toNumber(p?.purchaseRate),
      }
    })
    .sort((a, b) => a.product.localeCompare(b.product))

  return (
    <>
      <PageHeader title="Stock" description="Live stock by product and location (FIFO batch-backed)." />
      <StockTable rows={rows} />
    </>
  )
}
