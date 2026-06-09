import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { PurchaseForm } from "../purchase-form"

export const metadata: Metadata = { title: "New Purchase" }

export default async function NewPurchasePage() {
  const { firmId } = await requirePermission("purchase:create")

  const [firm, suppliers, locations, products] = await Promise.all([
    prisma.firm.findUnique({ where: { id: firmId }, select: { stateCode: true } }),
    prisma.supplier.findMany({ where: { firmId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { firmId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { firmId, isActive: true }, include: { taxGroup: true }, orderBy: { name: "asc" } }),
  ])

  const defaultLocation = locations.find((l) => l.isDefault) ?? locations[0]

  return (
    <>
      <PageHeader title="New purchase" description="Record a purchase — stock batches and ledgers update automatically." />
      <PurchaseForm
        firmStateCode={firm?.stateCode ?? null}
        defaultLocationId={defaultLocation?.id}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, stateCode: s.stateCode }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        products={products.map((p) => ({
          id: p.id, name: p.name, sku: p.sku, unit: p.unit,
          purchaseRate: toNumber(p.purchaseRate),
          gstRate: toNumber(p.taxGroup?.gstRate),
          cessRate: toNumber(p.taxGroup?.cessRate),
        }))}
      />
    </>
  )
}
