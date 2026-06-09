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

export const metadata: Metadata = { title: "Supplier Statement" }

export default async function SupplierLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { firmId } = await requirePermission("ledger:view")

  const supplier = await prisma.supplier.findFirst({ where: { id, firmId } })
  if (!supplier) notFound()

  const entries = await prisma.supplierLedger.findMany({
    where: { firmId, supplierId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  })

  const rows: LedgerEntry[] = entries.map((e) => ({
    id: e.id, date: e.entryDate.toISOString(), particulars: e.particulars,
    debit: toNumber(e.debit), credit: toNumber(e.credit), balance: toNumber(e.balance),
  }))

  return (
    <>
      <PageHeader title={supplier.name} description={`Closing balance: ${formatCurrency(supplier.balance)}`}>
        <Button variant="outline" asChild><Link href="/ledgers/suppliers"><ArrowLeft className="size-4" /> Back</Link></Button>
      </PageHeader>
      <LedgerEntriesTable entries={rows} />
    </>
  )
}
