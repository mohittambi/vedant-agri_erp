import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { PartyBalanceList, type PartyBalanceRow } from "@/components/ledger/ledger-views"

export const metadata: Metadata = { title: "Supplier Ledger" }

export default async function SupplierLedgerListPage() {
  const { firmId } = await requirePermission("ledger:view")
  const suppliers = await prisma.supplier.findMany({ where: { firmId }, orderBy: { name: "asc" } })
  const rows: PartyBalanceRow[] = suppliers.map((s) => ({ id: s.id, name: s.name, phone: s.phone, balance: toNumber(s.balance) }))
  return (
    <>
      <PageHeader title="Supplier ledger" description="Outstanding payables by supplier. Click a name for the statement." />
      <PartyBalanceList rows={rows} basePath="/ledgers/suppliers" />
    </>
  )
}
