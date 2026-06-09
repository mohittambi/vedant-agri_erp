"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { nextDocNumber } from "@/lib/actions/doc-number"
import { salesSchema, type SalesInput } from "@/lib/validations/sales"
import { computeDocument, resolveGstTreatment } from "@/lib/gst"
import { toNumber } from "@/lib/format"
import type { ActionResult } from "@/lib/actions/firm-actions"

function toDate(s?: string) {
  return s && s.length ? new Date(s) : null
}

/**
 * Create a sales invoice. Enforces:
 *  - Real-time stock check (refuses if non-expired stock is insufficient)
 *  - Expired stock cannot be sold (FIFO only consumes non-expired batches)
 *  - FIFO consumption (oldest received batch first)
 *  - GST auto-calculation (CGST/SGST vs IGST by customer state)
 *  - Customer ledger + balance update
 */
export async function createSale(values: SalesInput): Promise<ActionResult> {
  const { user, firmId } = await requirePermission("sales:create")
  const parsed = salesSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> }
  }
  const input = parsed.data
  const customerId = input.customerId && input.customerId.length ? input.customerId : null

  const [firm, customer, location, products] = await Promise.all([
    prisma.firm.findUnique({ where: { id: firmId } }),
    customerId ? prisma.customer.findFirst({ where: { id: customerId, firmId } }) : Promise.resolve(null),
    prisma.location.findFirst({ where: { id: input.locationId, firmId } }),
    prisma.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) }, firmId }, include: { taxGroup: true } }),
  ])
  if (!location) return { ok: false, error: "Location not found." }
  if (customerId && !customer) return { ok: false, error: "Customer not found." }

  const productMap = new Map(products.map((p) => [p.id, p]))
  for (const it of input.items) if (!productMap.has(it.productId)) return { ok: false, error: "Invalid product in items." }

  const treatment = resolveGstTreatment(firm?.stateCode, customer?.stateCode)

  const gstLines = input.items.map((it) => {
    const product = productMap.get(it.productId)!
    return {
      quantity: it.quantity,
      rate: it.rate,
      discountPct: it.discountPct,
      gstRate: toNumber(product.taxGroup?.gstRate),
      cessRate: toNumber(product.taxGroup?.cessRate),
    }
  })
  const doc = computeDocument(gstLines, treatment)

  const isCash = input.saleType === "CASH"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const settings = await prisma.setting.findUnique({ where: { firmId } })

  try {
    const result = await prisma.$transaction(async (tx) => {
      // --- Real-time stock check + FIFO allocation plan (non-expired only) ---
      type Alloc = { batchId: string; batchNumber: string; qty: number }
      const allocations: Alloc[][] = []
      for (let i = 0; i < input.items.length; i++) {
        const it = input.items[i]
        const product = productMap.get(it.productId)!
        const batches = await tx.inventoryBatch.findMany({
          where: {
            firmId, productId: it.productId, locationId: location.id,
            quantity: { gt: 0 },
            OR: [{ expiryDate: null }, { expiryDate: { gte: today } }],
          },
          orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
        })
        const available = batches.reduce((s, b) => s + toNumber(b.quantity), 0)
        if (available < it.quantity) {
          throw new Error(`Insufficient sellable stock for ${product.name}: available ${available}, need ${it.quantity}`)
        }
        let remaining = it.quantity
        const plan: Alloc[] = []
        for (const b of batches) {
          if (remaining <= 0) break
          const take = Math.min(remaining, toNumber(b.quantity))
          plan.push({ batchId: b.id, batchNumber: b.batchNumber, qty: take })
          remaining -= take
        }
        allocations.push(plan)
      }

      const invoiceNumber = await nextDocNumber(tx, firmId, "salesInvoice", settings?.invoicePrefix ?? "INV")

      const invoice = await tx.salesInvoice.create({
        data: {
          firmId, customerId, locationId: location.id, invoiceNumber,
          invoiceDate: new Date(input.invoiceDate), dueDate: toDate(input.dueDate),
          status: isCash ? "PAID" : "CONFIRMED", saleType: input.saleType, gstTreatment: treatment,
          subtotal: doc.subtotal, discountAmount: doc.discountAmount, taxableAmount: doc.taxableAmount,
          cgstAmount: doc.cgstAmount, sgstAmount: doc.sgstAmount, igstAmount: doc.igstAmount,
          cessAmount: doc.cessAmount, roundOff: doc.roundOff, grandTotal: doc.grandTotal,
          paidAmount: isCash ? doc.grandTotal : 0, notes: input.notes || null, createdById: user.id,
        },
      })

      for (let i = 0; i < input.items.length; i++) {
        const it = input.items[i]
        const line = doc.lines[i]
        const plan = allocations[i]

        await tx.salesInvoiceItem.create({
          data: {
            invoiceId: invoice.id, productId: it.productId,
            batchId: plan[0]?.batchId ?? null, batchNumber: plan.map((p) => p.batchNumber).join(", "),
            quantity: it.quantity, rate: it.rate, discountPct: it.discountPct ?? 0,
            discountAmount: line.discountAmount, taxableAmount: line.taxableAmount, gstRate: line.gstRate,
            cgstAmount: line.cgstAmount, sgstAmount: line.sgstAmount, igstAmount: line.igstAmount, total: line.total,
          },
        })

        // Deduct each allocated batch (FIFO) + stock ledger.
        for (const a of plan) {
          await tx.inventoryBatch.update({ where: { id: a.batchId }, data: { quantity: { decrement: a.qty } } })
          const agg = await tx.inventoryBatch.aggregate({
            where: { firmId, productId: it.productId, locationId: location.id }, _sum: { quantity: true },
          })
          await tx.stockLedger.create({
            data: {
              firmId, productId: it.productId, locationId: location.id, batchId: a.batchId,
              txnType: "SALE", referenceType: "SALES_INVOICE", referenceId: invoice.id,
              quantityIn: 0, quantityOut: a.qty, balance: toNumber(agg._sum.quantity), rate: it.rate,
              createdById: user.id,
            },
          })
        }
      }

      // Customer ledger + balance.
      if (customer) {
        let bal = toNumber(customer.balance)
        bal += doc.grandTotal // sale → customer owes us (debit)
        await tx.customerLedger.create({
          data: {
            firmId, customerId: customer.id, entryDate: new Date(input.invoiceDate),
            referenceType: "SALES_INVOICE", referenceId: invoice.id,
            particulars: `Sale ${invoiceNumber}`, entryType: "DEBIT",
            debit: doc.grandTotal, credit: 0, balance: bal,
          },
        })
        if (isCash) {
          bal -= doc.grandTotal
          await tx.customerLedger.create({
            data: {
              firmId, customerId: customer.id, entryDate: new Date(input.invoiceDate),
              referenceType: "SALES_INVOICE", referenceId: invoice.id,
              particulars: `Receipt (cash) ${invoiceNumber}`, entryType: "CREDIT",
              debit: 0, credit: doc.grandTotal, balance: bal,
            },
          })
        }
        await tx.customer.update({ where: { id: customer.id }, data: { balance: bal } })
      }

      return invoice
    })

    await logAudit({
      firmId, userId: user.id, action: "CREATE", entity: "SalesInvoice",
      entityId: result.id, newData: { invoiceNumber: result.invoiceNumber, grandTotal: doc.grandTotal },
    })
    revalidatePath("/sales")
    revalidatePath("/inventory")
    return { ok: true, id: result.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create sale." }
  }
}
