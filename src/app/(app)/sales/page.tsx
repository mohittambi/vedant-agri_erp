import type { Metadata } from "next"
import { requirePermission, userHasPermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { InvoiceList, type InvoiceRow } from "@/components/invoices/invoice-list"

export const metadata: Metadata = { title: "Sales" }

export default async function SalesPage() {
  const { user, firmId } = await requirePermission("sales:view")
  const invoices = await prisma.salesInvoice.findMany({
    where: { firmId },
    orderBy: { invoiceDate: "desc" },
    include: { customer: { select: { name: true } } },
    take: 200,
  })

  const rows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    number: inv.invoiceNumber,
    date: inv.invoiceDate.toISOString(),
    party: inv.customer?.name ?? "Walk-in / Cash",
    total: toNumber(inv.grandTotal),
    status: inv.status,
    mode: inv.saleType,
  }))

  return (
    <>
      <PageHeader title="Sales" description="Sales invoices — FIFO stock + customer ledger updated automatically." />
      <InvoiceList
        rows={rows}
        basePath="/sales"
        partyLabel="Customer"
        canCreate={userHasPermission(user, "sales:create")}
        newLabel="New sale"
      />
    </>
  )
}
