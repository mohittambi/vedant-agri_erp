import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { InvoiceDetail, type InvoiceView } from "@/components/invoices/invoice-detail"

export const metadata: Metadata = { title: "Sales Return" }

export default async function SalesReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { firmId } = await requirePermission("sales_return:view")

  const ret = await prisma.salesReturn.findFirst({
    where: { id, firmId },
    include: {
      customer: true,
      firm: true,
      sale: { select: { invoiceNumber: true } },
      items: { include: { product: { select: { name: true, hsnCode: true } } } },
    },
  })
  if (!ret) notFound()

  const view: InvoiceView = {
    title: "Credit Note",
    number: ret.returnNumber,
    date: ret.returnDate.toISOString(),
    status: ret.status,
    treatment: ret.gstTreatment,
    firm: { name: ret.firm.name, gstin: ret.firm.gstin, address: ret.firm.address, state: ret.firm.state },
    party: {
      label: "Customer",
      name: ret.customer?.name ?? "Walk-in / Cash",
      gstin: ret.customer?.gstin ?? null,
      address: ret.customer?.address ?? null,
      state: ret.customer?.state ?? null,
    },
    items: ret.items.map((it) => ({
      name: it.product.name,
      hsn: it.product.hsnCode,
      batch: it.batchNumber,
      qty: toNumber(it.quantity),
      rate: toNumber(it.rate),
      discount: 0,
      taxable: toNumber(it.taxableAmount),
      gstRate: toNumber(it.gstRate),
      cgst: toNumber(it.cgstAmount),
      sgst: toNumber(it.sgstAmount),
      igst: toNumber(it.igstAmount),
      total: toNumber(it.total),
    })),
    totals: {
      taxable: toNumber(ret.taxableAmount),
      cgst: toNumber(ret.cgstAmount),
      sgst: toNumber(ret.sgstAmount),
      igst: toNumber(ret.igstAmount),
      cess: 0,
      roundOff: 0,
      grandTotal: toNumber(ret.grandTotal),
    },
  }

  const description = [
    ret.customer?.name ?? "Walk-in / Cash",
    ret.sale ? `against ${ret.sale.invoiceNumber}` : null,
    ret.reason ? `Reason: ${ret.reason}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <>
      <PageHeader title={`Credit Note ${ret.returnNumber}`} description={description}>
        <Button variant="outline" asChild>
          <Link href="/sales-returns"><ArrowLeft className="size-4" /> Back</Link>
        </Button>
      </PageHeader>
      <InvoiceDetail view={view} />
    </>
  )
}
