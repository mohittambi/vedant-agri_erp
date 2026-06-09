import type { Metadata } from "next"
import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatCurrency, toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/dashboard/stat-card"
import {
  SalesTrendChart,
  type TrendPoint,
} from "@/components/dashboard/sales-trend-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Dashboard" }

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

async function getDashboardData(firmId: string) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const from14 = new Date(now)
  from14.setDate(now.getDate() - 13)
  from14.setHours(0, 0, 0, 0)
  const expiryCutoff = new Date(now)
  expiryCutoff.setDate(now.getDate() + 90)

  const [
    monthSales,
    receivables,
    payables,
    productCount,
    customerCount,
    supplierCount,
    expiringSoon,
    salesRows,
    purchaseRows,
  ] = await Promise.all([
    prisma.salesInvoice.aggregate({
      where: { firmId, status: { not: "CANCELLED" }, invoiceDate: { gte: monthStart } },
      _sum: { grandTotal: true },
    }),
    prisma.customer.aggregate({ where: { firmId }, _sum: { balance: true } }),
    prisma.supplier.aggregate({ where: { firmId }, _sum: { balance: true } }),
    prisma.product.count({ where: { firmId, isActive: true } }),
    prisma.customer.count({ where: { firmId, isActive: true } }),
    prisma.supplier.count({ where: { firmId, isActive: true } }),
    prisma.inventoryBatch.count({
      where: { firmId, quantity: { gt: 0 }, expiryDate: { gte: now, lte: expiryCutoff } },
    }),
    prisma.salesInvoice.findMany({
      where: { firmId, status: { not: "CANCELLED" }, invoiceDate: { gte: from14 } },
      select: { invoiceDate: true, grandTotal: true },
    }),
    prisma.purchaseInvoice.findMany({
      where: { firmId, status: { not: "CANCELLED" }, invoiceDate: { gte: from14 } },
      select: { invoiceDate: true, grandTotal: true },
    }),
  ])

  // Bucket the last 14 days.
  const buckets = new Map<string, TrendPoint>()
  for (let i = 0; i < 14; i++) {
    const d = new Date(from14)
    d.setDate(from14.getDate() + i)
    buckets.set(dayKey(d), {
      label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      sales: 0,
      purchases: 0,
    })
  }
  for (const r of salesRows) {
    const b = buckets.get(dayKey(r.invoiceDate))
    if (b) b.sales += toNumber(r.grandTotal)
  }
  for (const r of purchaseRows) {
    const b = buckets.get(dayKey(r.invoiceDate))
    if (b) b.purchases += toNumber(r.grandTotal)
  }

  return {
    monthSales: monthSales._sum.grandTotal,
    receivables: receivables._sum.balance,
    payables: payables._sum.balance,
    productCount,
    customerCount,
    supplierCount,
    expiringSoon,
    trend: [...buckets.values()],
  }
}

export default async function DashboardPage() {
  const user = await requireAuth()

  if (!user.activeFirmId) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>No firm assigned</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Your account is not linked to any firm yet. A Super Admin needs to
            create a firm and assign you a role.
          </p>
          {user.isSuperAdmin && (
            <Button asChild>
              <Link href="/firms">Create your first firm</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const d = await getDashboardData(user.activeFirmId)

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.fullName.split(" ")[0]}`}
        description="Here's what's happening across your firm today."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sales (this month)" value={formatCurrency(d.monthSales)} icon="Receipt" tone="success" />
        <StatCard label="Receivables" value={formatCurrency(d.receivables)} icon="BookUser" hint="Outstanding from customers" />
        <StatCard label="Payables" value={formatCurrency(d.payables)} icon="Truck" tone="warning" hint="Owed to suppliers" />
        <StatCard label="Expiring ≤ 90 days" value={String(d.expiringSoon)} icon="CalendarClock" tone="danger" hint="Batches needing attention" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SalesTrendChart data={d.trend} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Master data</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Row label="Products" value={d.productCount} href="/products" />
            <Row label="Customers" value={d.customerCount} href="/customers" />
            <Row label="Suppliers" value={d.supplierCount} href="/suppliers" />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function Row({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent"
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </Link>
  )
}
