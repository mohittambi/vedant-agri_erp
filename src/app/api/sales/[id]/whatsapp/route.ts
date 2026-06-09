import { type NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber, formatCurrency } from "@/lib/format"
import { waMeLink } from "@/lib/whatsapp"

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const { firmId } = await requirePermission("sales:view")

  const inv = await prisma.salesInvoice.findFirst({
    where: { id, firmId },
    include: { customer: true, firm: true },
  })
  if (!inv) return new Response("Not found", { status: 404 })

  const phone = inv.customer?.phone
  if (!phone) {
    return new Response("Customer has no phone number on file.", { status: 400 })
  }

  const origin = req.nextUrl.origin
  const message =
    `Namaste ${inv.customer?.name ?? ""}!\n\n` +
    `Invoice *${inv.invoiceNumber}* from ${inv.firm.name}\n` +
    `Date: ${inv.invoiceDate.toLocaleDateString("en-IN")}\n` +
    `Amount: ${formatCurrency(toNumber(inv.grandTotal))}\n\n` +
    `View / download: ${origin}/api/sales/${inv.id}/pdf\n\n` +
    `Thank you for your business!`

  const link = waMeLink(phone, message)
  if (!link) return new Response("Invalid phone number.", { status: 400 })

  return NextResponse.redirect(link)
}
