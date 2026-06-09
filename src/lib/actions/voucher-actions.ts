"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { nextDocNumber } from "@/lib/actions/doc-number"
import { voucherSchema, type VoucherInput } from "@/lib/validations/voucher"
import { toNumber } from "@/lib/format"
import type { ActionResult } from "@/lib/actions/firm-actions"

export async function createVoucher(values: VoucherInput): Promise<ActionResult> {
  const { user, firmId } = await requirePermission("voucher:create")
  const parsed = voucherSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> }
  }
  const v = parsed.data
  const settings = await prisma.setting.findUnique({ where: { firmId } })
  const partyId = v.partyId && v.partyId.length ? v.partyId : null
  const partyType = v.partyType && v.partyType.length ? v.partyType : null

  try {
    const result = await prisma.$transaction(async (tx) => {
      const voucherNumber = await nextDocNumber(tx, firmId, "voucher", settings?.voucherPrefix ?? "VCH")

      const voucher = await tx.voucher.create({
        data: {
          firmId, voucherType: v.voucherType, voucherNumber,
          voucherDate: new Date(v.voucherDate),
          partyType: partyType ?? undefined, partyId,
          amount: v.amount, mode: v.mode,
          referenceNo: v.referenceNo || null, narration: v.narration || null,
          createdById: user.id,
        },
      })

      // RECEIPT from a customer reduces their receivable balance.
      if (v.voucherType === "RECEIPT" && partyId) {
        const customer = await tx.customer.findFirst({ where: { id: partyId, firmId } })
        if (!customer) throw new Error("Customer not found.")
        const bal = toNumber(customer.balance) - v.amount
        await tx.customerLedger.create({
          data: {
            firmId, customerId: partyId, entryDate: new Date(v.voucherDate),
            referenceType: "VOUCHER", referenceId: voucher.id,
            particulars: `Receipt ${voucherNumber} (${v.mode})`, entryType: "CREDIT",
            debit: 0, credit: v.amount, balance: bal,
          },
        })
        await tx.customer.update({ where: { id: partyId }, data: { balance: bal } })
      }

      // PAYMENT to a supplier reduces our payable balance.
      if (v.voucherType === "PAYMENT" && partyId) {
        const supplier = await tx.supplier.findFirst({ where: { id: partyId, firmId } })
        if (!supplier) throw new Error("Supplier not found.")
        const bal = toNumber(supplier.balance) - v.amount
        await tx.supplierLedger.create({
          data: {
            firmId, supplierId: partyId, entryDate: new Date(v.voucherDate),
            referenceType: "VOUCHER", referenceId: voucher.id,
            particulars: `Payment ${voucherNumber} (${v.mode})`, entryType: "DEBIT",
            debit: v.amount, credit: 0, balance: bal,
          },
        })
        await tx.supplier.update({ where: { id: partyId }, data: { balance: bal } })
      }

      return voucher
    })

    await logAudit({
      firmId, userId: user.id, action: "CREATE", entity: "Voucher",
      entityId: result.id, newData: { voucherNumber: result.voucherNumber, amount: v.amount, type: v.voucherType },
    })
    revalidatePath("/vouchers")
    revalidatePath("/ledgers/customers")
    revalidatePath("/ledgers/suppliers")
    return { ok: true, id: result.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create voucher." }
  }
}
