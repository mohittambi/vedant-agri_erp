import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber, formatCurrency, formatNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { PeriodFilter } from "@/components/reports/period-filter"
import { StatCard } from "@/components/dashboard/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = { title: "Profit & Loss" }

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number)
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) }
}

export default async function PnlReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { firmId } = await requirePermission("report:view")
  const sp = await searchParams
  const now = new Date()
  const month = sp.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const { start, end } = monthRange(month)

  const notCancelled = { not: "CANCELLED" as const }
  const [sales, salesRet, purchases, purchaseRet] = await Promise.all([
    prisma.salesInvoice.aggregate({ where: { firmId, status: notCancelled, invoiceDate: { gte: start, lt: end } }, _sum: { taxableAmount: true } }),
    prisma.salesReturn.aggregate({ where: { firmId, returnDate: { gte: start, lt: end } }, _sum: { taxableAmount: true } }),
    prisma.purchaseInvoice.aggregate({ where: { firmId, status: notCancelled, invoiceDate: { gte: start, lt: end } }, _sum: { taxableAmount: true } }),
    prisma.purchaseReturn.aggregate({ where: { firmId, returnDate: { gte: start, lt: end } }, _sum: { taxableAmount: true } }),
  ])

  const netSales = toNumber(sales._sum.taxableAmount) - toNumber(salesRet._sum.taxableAmount)
  const netPurchases = toNumber(purchases._sum.taxableAmount) - toNumber(purchaseRet._sum.taxableAmount)
  const grossProfit = netSales - netPurchases
  const margin = netSales > 0 ? (grossProfit / netSales) * 100 : 0

  const lines = [
    { label: "Sales", value: toNumber(sales._sum.taxableAmount) },
    { label: "Less: Sales returns", value: -toNumber(salesRet._sum.taxableAmount) },
    { label: "Net sales", value: netSales, strong: true },
    { label: "Purchases", value: -toNumber(purchases._sum.taxableAmount) },
    { label: "Add: Purchase returns", value: toNumber(purchaseRet._sum.taxableAmount) },
    { label: "Net purchases (COGS)", value: -netPurchases, strong: true },
    { label: "Gross profit", value: grossProfit, strong: true },
  ]

  return (
    <>
      <PageHeader title="Profit & Loss" description="Trading account for the period (taxable values, excl. GST).">
        <PeriodFilter month={month} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Net sales" value={formatCurrency(netSales)} icon="TrendingUp" tone="success" />
        <StatCard label="COGS (net purchases)" value={formatCurrency(netPurchases)} icon="ShoppingCart" tone="warning" />
        <StatCard label="Gross profit" value={formatCurrency(grossProfit)} icon="ChartLine" tone={grossProfit >= 0 ? "success" : "danger"} hint={`Margin ${formatNumber(margin, 1)}%`} />
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Statement</CardTitle></CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {lines.map((l) => (
            <div key={l.label} className={`flex justify-between py-1 ${l.strong ? "border-t font-semibold" : "text-muted-foreground"}`}>
              <span>{l.label}</span>
              <span className="tabular-nums text-foreground">{formatCurrency(l.value)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
