"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { nextDocNumber } from "@/lib/actions/doc-number"
import { salesReturnSchema, purchaseReturnSchema, type SalesReturnInput, type PurchaseReturnInput } from "@/lib/validations/return"
import { computeDocument, resolveGstTreatment } from "@/lib/gst"
import { toNumber } from "@/lib/format"
import type { ActionResult } from "@/lib/actions/firm-actions"

// ---------------------------------------------------------------------------
// Sales return — goods come BACK into stock; customer is credited.
// ---------------------------------------------------------------------------
export async function createSalesReturn(values: SalesReturnInput): Promise<ActionResult> {
  const { user, firmId } = await requirePermission("sales_return:create")
  const parsed = salesReturnSchema.safeParse(values)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> }
  const input = parsed.data
  const customerId = input.customerId && input.customerId.length ? input.customerId : null

  const [firm, customer, products] = await Promise.all([
    prisma.firm.findUnique({ where: { id: firmId } }),
    customerId ? prisma.customer.findFirst({ where: { id: customerId, firmId } }) : Promise.resolve(null),
    prisma.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) }, firmId }, include: { taxGroup: true } }),
  ])
  const pMap = new Map(products.map((p) => [p.id, p]))
  const treatment = resolveGstTreatment(firm?.stateCode, customer?.stateCode)
  const doc = computeDocument(
    input.items.map((it) => ({ quantity: it.quantity, rate: it.rate, gstRate: toNumber(pMap.get(it.productId)?.taxGroup?.gstRate), cessRate: toNumber(pMap.get(it.productId)?.taxGroup?.cessRate) })),
    treatment
  )

  try {
    const result = await prisma.$transaction(async (tx) => {
      const returnNumber = await nextDocNumber(tx, firmId, "salesReturn", "SRT")
      const ret = await tx.salesReturn.create({
        data: {
          firmId, customerId, returnNumber, returnDate: new Date(input.returnDate), gstTreatment: treatment,
          taxableAmount: doc.taxableAmount, cgstAmount: doc.cgstAmount, sgstAmount: doc.sgstAmount, igstAmount: doc.igstAmount,
          grandTotal: doc.grandTotal, reason: input.reason || null, createdById: user.id,
        },
      })
      for (let i = 0; i < input.items.length; i++) {
        const it = input.items[i]; const line = doc.lines[i]
        await tx.salesReturnItem.create({
          data: {
            returnId: ret.id, productId: it.productId, quantity: it.quantity, rate: it.rate,
            taxableAmount: line.taxableAmount, gstRate: line.gstRate, cgstAmount: line.cgstAmount,
            sgstAmount: line.sgstAmount, igstAmount: line.igstAmount, total: line.total,
          },
        })
        // Goods back into a return batch.
        const batchNumber = `RET-${returnNumber}`
        const existing = await tx.inventoryBatch.findUnique({
          where: { firmId_productId_locationId_batchNumber: { firmId, productId: it.productId, locationId: input.locationId, batchNumber } },
        })
        const batch = existing
          ? await tx.inventoryBatch.update({ where: { id: existing.id }, data: { quantity: { increment: it.quantity } } })
          : await tx.inventoryBatch.create({ data: { firmId, productId: it.productId, locationId: input.locationId, batchNumber, quantity: it.quantity, purchaseRate: it.rate } })
        const agg = await tx.inventoryBatch.aggregate({ where: { firmId, productId: it.productId, locationId: input.locationId }, _sum: { quantity: true } })
        await tx.stockLedger.create({
          data: { firmId, productId: it.productId, locationId: input.locationId, batchId: batch.id, txnType: "SALE_RETURN", referenceType: "SALES_RETURN", referenceId: ret.id, quantityIn: it.quantity, quantityOut: 0, balance: toNumber(agg._sum.quantity), rate: it.rate, createdById: user.id },
        })
      }
      if (customer) {
        const bal = toNumber(customer.balance) - doc.grandTotal
        await tx.customerLedger.create({
          data: { firmId, customerId: customer.id, entryDate: new Date(input.returnDate), referenceType: "SALES_RETURN", referenceId: ret.id, particulars: `Sales return ${returnNumber}`, entryType: "CREDIT", debit: 0, credit: doc.grandTotal, balance: bal },
        })
        await tx.customer.update({ where: { id: customer.id }, data: { balance: bal } })
      }
      return ret
    })
    await logAudit({ firmId, userId: user.id, action: "CREATE", entity: "SalesReturn", entityId: result.id, newData: { returnNumber: result.returnNumber, grandTotal: doc.grandTotal } })
    revalidatePath("/sales-returns"); revalidatePath("/inventory")
    return { ok: true, id: result.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create sales return." }
  }
}

// ---------------------------------------------------------------------------
// Purchase return — goods go OUT of stock (FIFO); supplier payable reduced.
// ---------------------------------------------------------------------------
export async function createPurchaseReturn(values: PurchaseReturnInput): Promise<ActionResult> {
  const { user, firmId } = await requirePermission("purchase_return:create")
  const parsed = purchaseReturnSchema.safeParse(values)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> }
  const input = parsed.data

  const [firm, supplier, products] = await Promise.all([
    prisma.firm.findUnique({ where: { id: firmId } }),
    prisma.supplier.findFirst({ where: { id: input.supplierId, firmId } }),
    prisma.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) }, firmId }, include: { taxGroup: true } }),
  ])
  if (!supplier) return { ok: false, error: "Supplier not found." }
  const pMap = new Map(products.map((p) => [p.id, p]))
  const treatment = resolveGstTreatment(firm?.stateCode, supplier.stateCode)
  const doc = computeDocument(
    input.items.map((it) => ({ quantity: it.quantity, rate: it.rate, gstRate: toNumber(pMap.get(it.productId)?.taxGroup?.gstRate), cessRate: toNumber(pMap.get(it.productId)?.taxGroup?.cessRate) })),
    treatment
  )

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify + plan FIFO removal first.
      for (const it of input.items) {
        const agg = await tx.inventoryBatch.aggregate({ where: { firmId, productId: it.productId, locationId: input.locationId, quantity: { gt: 0 } }, _sum: { quantity: true } })
        if (toNumber(agg._sum.quantity) < it.quantity) {
          throw new Error(`Insufficient stock to return for product ${pMap.get(it.productId)?.name ?? ""}`)
        }
      }
      const returnNumber = await nextDocNumber(tx, firmId, "purchaseReturn", "PRT")
      const ret = await tx.purchaseReturn.create({
        data: {
          firmId, supplierId: supplier.id, returnNumber, returnDate: new Date(input.returnDate), gstTreatment: treatment,
          taxableAmount: doc.taxableAmount, cgstAmount: doc.cgstAmount, sgstAmount: doc.sgstAmount, igstAmount: doc.igstAmount,
          grandTotal: doc.grandTotal, reason: input.reason || null, createdById: user.id,
        },
      })
      for (let i = 0; i < input.items.length; i++) {
        const it = input.items[i]; const line = doc.lines[i]
        await tx.purchaseReturnItem.create({
          data: { returnId: ret.id, productId: it.productId, quantity: it.quantity, rate: it.rate, taxableAmount: line.taxableAmount, gstRate: line.gstRate, cgstAmount: line.cgstAmount, sgstAmount: line.sgstAmount, igstAmount: line.igstAmount, total: line.total },
        })
        // FIFO removal.
        let remaining = it.quantity
        const batches = await tx.inventoryBatch.findMany({ where: { firmId, productId: it.productId, locationId: input.locationId, quantity: { gt: 0 } }, orderBy: [{ receivedAt: "asc" }] })
        for (const b of batches) {
          if (remaining <= 0) break
          const take = Math.min(remaining, toNumber(b.quantity))
          await tx.inventoryBatch.update({ where: { id: b.id }, data: { quantity: { decrement: take } } })
          remaining -= take
          const agg = await tx.inventoryBatch.aggregate({ where: { firmId, productId: it.productId, locationId: input.locationId }, _sum: { quantity: true } })
          await tx.stockLedger.create({
            data: { firmId, productId: it.productId, locationId: input.locationId, batchId: b.id, txnType: "PURCHASE_RETURN", referenceType: "PURCHASE_RETURN", referenceId: ret.id, quantityIn: 0, quantityOut: take, balance: toNumber(agg._sum.quantity), rate: it.rate, createdById: user.id },
          })
        }
      }
      const bal = toNumber(supplier.balance) - doc.grandTotal
      await tx.supplierLedger.create({
        data: { firmId, supplierId: supplier.id, entryDate: new Date(input.returnDate), referenceType: "PURCHASE_RETURN", referenceId: ret.id, particulars: `Purchase return ${returnNumber}`, entryType: "DEBIT", debit: doc.grandTotal, credit: 0, balance: bal },
      })
      await tx.supplier.update({ where: { id: supplier.id }, data: { balance: bal } })
      return ret
    })
    await logAudit({ firmId, userId: user.id, action: "CREATE", entity: "PurchaseReturn", entityId: result.id, newData: { returnNumber: result.returnNumber, grandTotal: doc.grandTotal } })
    revalidatePath("/purchase-returns"); revalidatePath("/inventory")
    return { ok: true, id: result.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create purchase return." }
  }
}
