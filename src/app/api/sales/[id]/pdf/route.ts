import { type NextRequest } from "next/server"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { buildInvoicePdf, type PdfInvoice } from "@/lib/pdf/invoice-pdf"

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const { firmId } = await requirePermission("sales:view")

  const inv = await prisma.salesInvoice.findFirst({
    where: { id, firmId },
    include: {
      customer: true, firm: true,
      items: { include: { product: { select: { name: true } } } },
    },
  })
  if (!inv) return new Response("Not found", { status: 404 })

  const data: PdfInvoice = {
    title: "TAX INVOICE",
    number: inv.invoiceNumber,
    date: inv.invoiceDate.toISOString(),
    status: inv.status,
    treatment: inv.gstTreatment,
    firm: { name: inv.firm.name, gstin: inv.firm.gstin, address: inv.firm.address, state: inv.firm.state, phone: inv.firm.phone },
    party: { label: "Bill To", name: inv.customer?.name ?? "Walk-in / Cash", gstin: inv.customer?.gstin ?? null, state: inv.customer?.state ?? null },
    items: inv.items.map((it) => ({
      name: it.product.name, batch: it.batchNumber, qty: toNumber(it.quantity), rate: toNumber(it.rate),
      taxable: toNumber(it.taxableAmount), gstRate: toNumber(it.gstRate),
      cgst: toNumber(it.cgstAmount), sgst: toNumber(it.sgstAmount), igst: toNumber(it.igstAmount), total: toNumber(it.total),
    })),
    totals: {
      taxable: toNumber(inv.taxableAmount), cgst: toNumber(inv.cgstAmount), sgst: toNumber(inv.sgstAmount),
      igst: toNumber(inv.igstAmount), cess: toNumber(inv.cessAmount), roundOff: toNumber(inv.roundOff), grandTotal: toNumber(inv.grandTotal),
    },
  }

  const bytes = await buildInvoicePdf(data)
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${inv.invoiceNumber}.pdf"`,
    },
  })
}
