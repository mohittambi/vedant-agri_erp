import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { PartyBalanceList, type PartyBalanceRow } from "@/components/ledger/ledger-views"

export const metadata: Metadata = { title: "Customer Ledger" }

export default async function CustomerLedgerListPage() {
  const { firmId } = await requirePermission("ledger:view")
  const customers = await prisma.customer.findMany({ where: { firmId }, orderBy: { name: "asc" } })
  const rows: PartyBalanceRow[] = customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, balance: toNumber(c.balance) }))
  return (
    <>
      <PageHeader title="Customer ledger" description="Outstanding receivables by customer. Click a name for the statement." />
      <PartyBalanceList rows={rows} basePath="/ledgers/customers" />
    </>
  )
}
