import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber, formatCurrency } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { LedgerEntriesTable, type LedgerEntry } from "@/components/ledger/ledger-views"

export const metadata: Metadata = { title: "Customer Statement" }

export default async function CustomerLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { firmId } = await requirePermission("ledger:view")

  const customer = await prisma.customer.findFirst({ where: { id, firmId } })
  if (!customer) notFound()

  const entries = await prisma.customerLedger.findMany({
    where: { firmId, customerId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  })

  const rows: LedgerEntry[] = entries.map((e) => ({
    id: e.id, date: e.entryDate.toISOString(), particulars: e.particulars,
    debit: toNumber(e.debit), credit: toNumber(e.credit), balance: toNumber(e.balance),
  }))

  return (
    <>
      <PageHeader title={customer.name} description={`Closing balance: ${formatCurrency(customer.balance)}`}>
        <Button variant="outline" asChild><Link href="/ledgers/customers"><ArrowLeft className="size-4" /> Back</Link></Button>
      </PageHeader>
      <LedgerEntriesTable entries={rows} />
    </>
  )
}
