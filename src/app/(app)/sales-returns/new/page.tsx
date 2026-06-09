import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { ReturnForm } from "@/components/returns/return-form"

export const metadata: Metadata = { title: "New Sales Return" }

export default async function NewSalesReturnPage() {
  const { firmId } = await requirePermission("sales_return:create")
  const [firm, customers, locations, products] = await Promise.all([
    prisma.firm.findUnique({ where: { id: firmId }, select: { stateCode: true } }),
    prisma.customer.findMany({ where: { firmId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { firmId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { firmId, isActive: true }, include: { taxGroup: true }, orderBy: { name: "asc" } }),
  ])
  const defaultLocation = locations.find((l) => l.isDefault) ?? locations[0]
  return (
    <>
      <PageHeader title="New sales return" description="Goods returned by a customer." />
      <ReturnForm
        kind="sales"
        firmStateCode={firm?.stateCode ?? null}
        defaultLocationId={defaultLocation?.id}
        parties={customers.map((c) => ({ id: c.id, name: c.name, stateCode: c.stateCode }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, gstRate: toNumber(p.taxGroup?.gstRate), cessRate: toNumber(p.taxGroup?.cessRate), rate: toNumber(p.creditRate) }))}
      />
    </>
  )
}
