import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Download, MessageCircle } from "lucide-react"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { InvoiceDetail, type InvoiceView } from "@/components/invoices/invoice-detail"

export const metadata: Metadata = { title: "Sale" }

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { firmId } = await requirePermission("sales:view")

  const inv = await prisma.salesInvoice.findFirst({
    where: { id, firmId },
    include: {
      customer: true, location: true, firm: true,
      items: { include: { product: { select: { name: true, hsnCode: true } } } },
    },
  })
  if (!inv) notFound()

  const view: InvoiceView = {
    title: "Tax Invoice",
    number: inv.invoiceNumber,
    date: inv.invoiceDate.toISOString(),
    dueDate: inv.dueDate?.toISOString() ?? null,
    status: inv.status,
    mode: inv.saleType,
    treatment: inv.gstTreatment,
    firm: { name: inv.firm.name, gstin: inv.firm.gstin, address: inv.firm.address, state: inv.firm.state },
    party: {
      label: "Bill to",
      name: inv.customer?.name ?? "Walk-in / Cash",
      gstin: inv.customer?.gstin ?? null,
      address: inv.customer?.address ?? null,
      state: inv.customer?.state ?? null,
    },
    items: inv.items.map((it) => ({
      name: it.product.name, hsn: it.product.hsnCode, batch: it.batchNumber,
      qty: toNumber(it.quantity), rate: toNumber(it.rate), discount: toNumber(it.discountAmount),
      taxable: toNumber(it.taxableAmount), gstRate: toNumber(it.gstRate),
      cgst: toNumber(it.cgstAmount), sgst: toNumber(it.sgstAmount), igst: toNumber(it.igstAmount),
      total: toNumber(it.total),
    })),
    totals: {
      taxable: toNumber(inv.taxableAmount), cgst: toNumber(inv.cgstAmount), sgst: toNumber(inv.sgstAmount),
      igst: toNumber(inv.igstAmount), cess: toNumber(inv.cessAmount), roundOff: toNumber(inv.roundOff),
      grandTotal: toNumber(inv.grandTotal),
    },
  }

  return (
    <>
      <PageHeader title={`Sale ${inv.invoiceNumber}`} description={view.party.name}>
        <Button variant="outline" asChild><Link href="/sales"><ArrowLeft className="size-4" /> Back</Link></Button>
        <Button variant="outline" asChild><a href={`/api/sales/${inv.id}/pdf`} target="_blank"><Download className="size-4" /> PDF</a></Button>
        <Button variant="outline" asChild><a href={`/api/sales/${inv.id}/whatsapp`}><MessageCircle className="size-4" /> WhatsApp</a></Button>
      </PageHeader>
      <InvoiceDetail view={view} />
    </>
  )
}
