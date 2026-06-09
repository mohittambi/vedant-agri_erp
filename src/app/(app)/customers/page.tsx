import type { Metadata } from "next"
import { requirePermission, userHasPermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { PartyCrud, type PartyRow } from "@/components/party/party-crud"

export const metadata: Metadata = { title: "Customers" }

export default async function CustomersPage() {
  const { user, firmId } = await requirePermission("customer:view")
  const customers = await prisma.customer.findMany({
    where: { firmId },
    orderBy: { name: "asc" },
  })

  const rows: PartyRow[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    gstin: c.gstin,
    city: c.city,
    state: c.state,
    stateCode: c.stateCode,
    openingBalance: toNumber(c.openingBalance),
    balance: toNumber(c.balance),
    creditLimit: toNumber(c.creditLimit),
    isActive: c.isActive,
  }))

  return (
    <>
      <PageHeader title="Customers" description="Buyers — track balances, credit limits and ledgers." />
      <PartyCrud
        kind="customer"
        rows={rows}
        perms={{
          create: userHasPermission(user, "customer:create"),
          update: userHasPermission(user, "customer:update"),
        }}
      />
    </>
  )
}
