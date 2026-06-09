import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { SalesForm } from "../sales-form"

export const metadata: Metadata = { title: "New Sale" }

export default async function NewSalePage() {
  const { firmId } = await requirePermission("sales:create")

  const [firm, customers, locations, products, batches] = await Promise.all([
    prisma.firm.findUnique({ where: { id: firmId }, select: { stateCode: true } }),
    prisma.customer.findMany({ where: { firmId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { firmId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { firmId, isActive: true }, include: { taxGroup: true }, orderBy: { name: "asc" } }),
    prisma.inventoryBatch.groupBy({ by: ["productId", "locationId"], where: { firmId }, _sum: { quantity: true } }),
  ])

  const stock: Record<string, Record<string, number>> = {}
  for (const b of batches) {
    stock[b.productId] ??= {}
    stock[b.productId][b.locationId] = toNumber(b._sum.quantity)
  }

  const defaultLocation = locations.find((l) => l.isDefault) ?? locations[0]

  return (
    <>
      <PageHeader title="New sale" description="Cash/credit billing with FIFO stock deduction and GST." />
      <SalesForm
        firmStateCode={firm?.stateCode ?? null}
        defaultLocationId={defaultLocation?.id}
        customers={customers.map((c) => ({ id: c.id, name: c.name, stateCode: c.stateCode }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        products={products.map((p) => ({
          id: p.id, name: p.name, sku: p.sku, unit: p.unit,
          cashRate: toNumber(p.cashRate), creditRate: toNumber(p.creditRate),
          gstRate: toNumber(p.taxGroup?.gstRate), cessRate: toNumber(p.taxGroup?.cessRate),
        }))}
        stock={stock}
      />
    </>
  )
}
