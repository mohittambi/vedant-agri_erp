import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber, formatCurrency } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { PeriodFilter } from "@/components/reports/period-filter"
import { StatCard } from "@/components/dashboard/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

export const metadata: Metadata = { title: "GST Report" }

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)
  return { start, end }
}

export default async function GstReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { firmId } = await requirePermission("gst:view")
  const sp = await searchParams
  const now = new Date()
  const month = sp.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const { start, end } = monthRange(month)

  const where = { firmId, status: { not: "CANCELLED" as const }, invoiceDate: { gte: start, lt: end } }
  const [sales, purchases] = await Promise.all([
    prisma.salesInvoice.aggregate({ where, _sum: { taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true, grandTotal: true } }),
    prisma.purchaseInvoice.aggregate({ where, _sum: { taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true, grandTotal: true } }),
  ])

  const s = sales._sum, p = purchases._sum
  const outputTax = toNumber(s.cgstAmount) + toNumber(s.sgstAmount) + toNumber(s.igstAmount) + toNumber(s.cessAmount)
  const inputTax = toNumber(p.cgstAmount) + toNumber(p.sgstAmount) + toNumber(p.igstAmount) + toNumber(p.cessAmount)
  const netPayable = outputTax - inputTax

  const rows = [
    { label: "Output GST (Sales)", taxable: toNumber(s.taxableAmount), cgst: toNumber(s.cgstAmount), sgst: toNumber(s.sgstAmount), igst: toNumber(s.igstAmount), cess: toNumber(s.cessAmount), total: outputTax },
    { label: "Input GST (Purchases)", taxable: toNumber(p.taxableAmount), cgst: toNumber(p.cgstAmount), sgst: toNumber(p.sgstAmount), igst: toNumber(p.igstAmount), cess: toNumber(p.cessAmount), total: inputTax },
  ]

  return (
    <>
      <PageHeader title="GST report" description="GSTR-style summary of output and input tax for the period.">
        <PeriodFilter month={month} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Output GST (collected)" value={formatCurrency(outputTax)} icon="Receipt" tone="success" />
        <StatCard label="Input GST (credit)" value={formatCurrency(inputTax)} icon="ShoppingCart" tone="warning" />
        <StatCard label="Net GST payable" value={formatCurrency(netPayable)} icon="Percent" tone={netPayable >= 0 ? "danger" : "success"} />
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Tax breakup</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST</TableHead>
                <TableHead className="text-right">IGST</TableHead>
                <TableHead className="text-right">Cess</TableHead>
                <TableHead className="text-right">Total tax</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.taxable)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.cgst)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.sgst)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.igst)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.cess)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
