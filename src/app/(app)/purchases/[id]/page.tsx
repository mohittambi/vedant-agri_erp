import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Download } from "lucide-react"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { InvoiceDetail, type InvoiceView } from "@/components/invoices/invoice-detail"

export const metadata: Metadata = { title: "Purchase" }

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { firmId } = await requirePermission("purchase:view")

  const inv = await prisma.purchaseInvoice.findFirst({
    where: { id, firmId },
    include: {
      supplier: true,
      location: true,
      firm: true,
      items: { include: { product: { select: { name: true, hsnCode: true } } } },
    },
  })
  if (!inv) notFound()

  const view: InvoiceView = {
    title: "Purchase Invoice",
    number: inv.invoiceNumber,
    date: inv.invoiceDate.toISOString(),
    dueDate: inv.dueDate?.toISOString() ?? null,
    status: inv.status,
    mode: inv.paymentMode,
    treatment: inv.gstTreatment,
    firm: { name: inv.firm.name, gstin: inv.firm.gstin, address: inv.firm.address, state: inv.firm.state },
    party: { label: "Supplier", name: inv.supplier.name, gstin: inv.supplier.gstin, address: inv.supplier.address, state: inv.supplier.state },
    items: inv.items.map((it) => ({
      name: it.product.name,
      hsn: it.product.hsnCode,
      batch: it.batchNumber,
      qty: toNumber(it.quantity),
      free: toNumber(it.freeQuantity),
      rate: toNumber(it.rate),
      discount: toNumber(it.discountAmount),
      taxable: toNumber(it.taxableAmount),
      gstRate: toNumber(it.gstRate),
      cgst: toNumber(it.cgstAmount),
      sgst: toNumber(it.sgstAmount),
      igst: toNumber(it.igstAmount),
      total: toNumber(it.total),
    })),
    totals: {
      taxable: toNumber(inv.taxableAmount),
      cgst: toNumber(inv.cgstAmount),
      sgst: toNumber(inv.sgstAmount),
      igst: toNumber(inv.igstAmount),
      cess: toNumber(inv.cessAmount),
      roundOff: toNumber(inv.roundOff),
      grandTotal: toNumber(inv.grandTotal),
    },
  }

  return (
    <>
      <PageHeader title={`Purchase ${inv.invoiceNumber}`} description={inv.supplier.name}>
        <Button variant="outline" asChild><Link href="/purchases"><ArrowLeft className="size-4" /> Back</Link></Button>
        <Button variant="outline" asChild><a href={`/api/purchases/${inv.id}/pdf`} target="_blank"><Download className="size-4" /> PDF</a></Button>
      </PageHeader>
      <InvoiceDetail view={view} />
    </>
  )
}
