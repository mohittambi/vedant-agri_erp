import type { Metadata } from "next"
import { requirePermission, userHasPermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { ProductImportExport } from "@/components/products/import-export"
import { ProductsClient, type ProductRow, type Option } from "./products-client"

export const metadata: Metadata = { title: "Products" }

export default async function ProductsPage() {
  const { user, firmId } = await requirePermission("product:view")

  const [products, categories, manufacturers, taxGroups] = await Promise.all([
    prisma.product.findMany({
      where: { firmId },
      orderBy: { name: "asc" },
      include: { category: { select: { name: true } }, manufacturer: { select: { name: true } } },
    }),
    prisma.category.findMany({ where: { firmId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.manufacturer.findMany({ where: { firmId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.taxGroup.findMany({ where: { firmId, isActive: true }, orderBy: { name: "asc" } }),
  ])

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    hsnCode: p.hsnCode,
    unit: p.unit,
    categoryId: p.categoryId,
    manufacturerId: p.manufacturerId,
    taxGroupId: p.taxGroupId,
    categoryName: p.category?.name ?? null,
    manufacturerName: p.manufacturer?.name ?? null,
    cashRate: toNumber(p.cashRate),
    creditRate: toNumber(p.creditRate),
    mrp: toNumber(p.mrp),
    purchaseRate: toNumber(p.purchaseRate),
    reorderLevel: toNumber(p.reorderLevel),
    isBatchTracked: p.isBatchTracked,
    isActive: p.isActive,
  }))

  const toOpt = (xs: { id: string; name: string }[]): Option[] =>
    xs.map((x) => ({ value: x.id, label: x.name }))

  return (
    <>
      <PageHeader title="Products" description="Your product master — rates, tax group, batch settings.">
        <ProductImportExport canImport={userHasPermission(user, "product:create")} />
      </PageHeader>
      <ProductsClient
        products={rows}
        categories={toOpt(categories)}
        manufacturers={toOpt(manufacturers)}
        taxGroups={toOpt(taxGroups.map((t) => ({ id: t.id, name: `${t.name}` })))}
        perms={{
          create: userHasPermission(user, "product:create"),
          update: userHasPermission(user, "product:update"),
        }}
      />
    </>
  )
}
