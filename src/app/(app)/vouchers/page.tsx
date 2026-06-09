import type { Metadata } from "next"
import { requirePermission, userHasPermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { VouchersClient, type VoucherRow, type Option } from "./vouchers-client"

export const metadata: Metadata = { title: "Vouchers" }

export default async function VouchersPage() {
  const { user, firmId } = await requirePermission("voucher:view")

  const [vouchers, customers, suppliers] = await Promise.all([
    prisma.voucher.findMany({ where: { firmId }, orderBy: { voucherDate: "desc" }, take: 200 }),
    prisma.customer.findMany({ where: { firmId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ where: { firmId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])

  // Resolve party names for display.
  const custMap = new Map(customers.map((c) => [c.id, c.name]))
  const supMap = new Map(suppliers.map((s) => [s.id, s.name]))

  const rows: VoucherRow[] = vouchers.map((v) => ({
    id: v.id,
    number: v.voucherNumber,
    date: v.voucherDate.toISOString(),
    type: v.voucherType,
    party: v.partyId
      ? (v.partyType === "CUSTOMER" ? custMap.get(v.partyId) : supMap.get(v.partyId)) ?? "—"
      : "—",
    amount: toNumber(v.amount),
    mode: v.mode,
  }))

  const toOpt = (xs: { id: string; name: string }[]): Option[] => xs.map((x) => ({ value: x.id, label: x.name }))

  return (
    <>
      <PageHeader title="Vouchers" description="Payments, receipts, journals and contra entries." />
      <VouchersClient
        rows={rows}
        customers={toOpt(customers)}
        suppliers={toOpt(suppliers)}
        canCreate={userHasPermission(user, "voucher:create")}
      />
    </>
  )
}
