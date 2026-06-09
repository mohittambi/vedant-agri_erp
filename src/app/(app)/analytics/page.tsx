import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import {
  MonthlySalesChart, TopProductsChart, ModeSplitChart,
} from "@/components/analytics/analytics-charts"

export const metadata: Metadata = { title: "Analytics" }

export default async function AnalyticsPage() {
  const { firmId } = await requirePermission("analytics:view")
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const [sales, items, modeGroups, products] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { firmId, status: { not: "CANCELLED" }, invoiceDate: { gte: from } },
      select: { invoiceDate: true, grandTotal: true },
    }),
    prisma.salesInvoiceItem.groupBy({
      by: ["productId"],
      where: { invoice: { firmId, status: { not: "CANCELLED" } } },
      _sum: { total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 6,
    }),
    prisma.salesInvoice.groupBy({
      by: ["saleType"],
      where: { firmId, status: { not: "CANCELLED" } },
      _sum: { grandTotal: true },
    }),
    prisma.product.findMany({ where: { firmId }, select: { id: true, name: true } }),
  ])

  // Monthly buckets (12 months).
  const buckets = new Map<string, { label: string; sales: number }>()
  for (let i = 0; i < 12; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1)
    buckets.set(`${d.getFullYear()}-${d.getMonth()}`, {
      label: d.toLocaleDateString("en-IN", { month: "short" }),
      sales: 0,
    })
  }
  for (const s of sales) {
    const key = `${s.invoiceDate.getFullYear()}-${s.invoiceDate.getMonth()}`
    const b = buckets.get(key)
    if (b) b.sales += toNumber(s.grandTotal)
  }

  const pMap = new Map(products.map((p) => [p.id, p.name]))
  const topProducts = items.map((it) => ({ name: pMap.get(it.productId) ?? "—", value: toNumber(it._sum.total) }))
  const modeSplit = modeGroups.map((g) => ({ name: g.saleType, value: toNumber(g._sum.grandTotal) }))

  return (
    <>
      <PageHeader title="Analytics" description="Sales trends, best-sellers and payment mix." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MonthlySalesChart data={[...buckets.values()]} />
        <TopProductsChart data={topProducts} />
        <ModeSplitChart data={modeSplit} />
      </div>
    </>
  )
}
