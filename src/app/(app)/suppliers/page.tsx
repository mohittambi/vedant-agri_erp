import type { Metadata } from "next"
import { requirePermission, userHasPermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { PartyCrud, type PartyRow } from "@/components/party/party-crud"

export const metadata: Metadata = { title: "Suppliers" }

export default async function SuppliersPage() {
  const { user, firmId } = await requirePermission("supplier:view")
  const suppliers = await prisma.supplier.findMany({
    where: { firmId },
    orderBy: { name: "asc" },
  })

  const rows: PartyRow[] = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    email: s.email,
    gstin: s.gstin,
    city: s.city,
    state: s.state,
    stateCode: s.stateCode,
    openingBalance: toNumber(s.openingBalance),
    balance: toNumber(s.balance),
    isActive: s.isActive,
  }))

  return (
    <>
      <PageHeader title="Suppliers" description="Vendors — track payables and ledgers." />
      <PartyCrud
        kind="supplier"
        rows={rows}
        perms={{
          create: userHasPermission(user, "supplier:create"),
          update: userHasPermission(user, "supplier:update"),
        }}
      />
    </>
  )
}
