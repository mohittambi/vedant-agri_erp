import type { Metadata } from "next"
import { requirePermission, userHasPermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { InvoiceList, type InvoiceRow } from "@/components/invoices/invoice-list"

export const metadata: Metadata = { title: "Sales Returns" }

export default async function SalesReturnsPage() {
  const { user, firmId } = await requirePermission("sales_return:view")
  const returns = await prisma.salesReturn.findMany({
    where: { firmId }, orderBy: { returnDate: "desc" },
    include: { customer: { select: { name: true } } }, take: 200,
  })
  const rows: InvoiceRow[] = returns.map((r) => ({
    id: r.id, number: r.returnNumber, date: r.returnDate.toISOString(),
    party: r.customer?.name ?? "Walk-in / Cash", total: toNumber(r.grandTotal), status: r.status,
  }))
  return (
    <>
      <PageHeader title="Sales returns" description="Credit notes — stock returns to inventory, customer is credited." />
      <InvoiceList rows={rows} basePath="/sales-returns" partyLabel="Customer" canCreate={userHasPermission(user, "sales_return:create")} newLabel="New return" />
    </>
  )
}
