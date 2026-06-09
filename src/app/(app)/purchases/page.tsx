import type { Metadata } from "next"
import { requirePermission, userHasPermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { InvoiceList, type InvoiceRow } from "@/components/invoices/invoice-list"

export const metadata: Metadata = { title: "Purchases" }

export default async function PurchasesPage() {
  const { user, firmId } = await requirePermission("purchase:view")
  const invoices = await prisma.purchaseInvoice.findMany({
    where: { firmId },
    orderBy: { invoiceDate: "desc" },
    include: { supplier: { select: { name: true } } },
    take: 200,
  })

  const rows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    number: inv.invoiceNumber,
    date: inv.invoiceDate.toISOString(),
    party: inv.supplier.name,
    total: toNumber(inv.grandTotal),
    status: inv.status,
    mode: inv.paymentMode,
  }))

  return (
    <>
      <PageHeader title="Purchases" description="Purchase invoices — each updates stock and supplier ledger." />
      <InvoiceList
        rows={rows}
        basePath="/purchases"
        partyLabel="Supplier"
        canCreate={userHasPermission(user, "purchase:create")}
        newLabel="New purchase"
      />
    </>
  )
}
