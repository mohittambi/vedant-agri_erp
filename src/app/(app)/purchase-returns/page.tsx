import type { Metadata } from "next"
import { requirePermission, userHasPermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { InvoiceList, type InvoiceRow } from "@/components/invoices/invoice-list"

export const metadata: Metadata = { title: "Purchase Returns" }

export default async function PurchaseReturnsPage() {
  const { user, firmId } = await requirePermission("purchase_return:view")
  const returns = await prisma.purchaseReturn.findMany({
    where: { firmId }, orderBy: { returnDate: "desc" },
    include: { supplier: { select: { name: true } } }, take: 200,
  })
  const rows: InvoiceRow[] = returns.map((r) => ({
    id: r.id, number: r.returnNumber, date: r.returnDate.toISOString(),
    party: r.supplier.name, total: toNumber(r.grandTotal), status: r.status,
  }))
  return (
    <>
      <PageHeader title="Purchase returns" description="Debit notes — stock returns to supplier, payable reduced." />
      <InvoiceList rows={rows} basePath="/purchase-returns" partyLabel="Supplier" canCreate={userHasPermission(user, "purchase_return:create")} newLabel="New return" />
    </>
  )
}
