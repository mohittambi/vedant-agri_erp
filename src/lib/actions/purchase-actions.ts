"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { nextDocNumber } from "@/lib/actions/doc-number"
import { purchaseSchema, type PurchaseInput } from "@/lib/validations/purchase"
import { computeDocument, computeLine, resolveGstTreatment } from "@/lib/gst"
import { toNumber } from "@/lib/format"
import type { ActionResult } from "@/lib/actions/firm-actions"

function toDate(s?: string) {
  return s && s.length ? new Date(s) : null
}

export async function createPurchase(values: PurchaseInput): Promise<ActionResult> {
  const { user, firmId } = await requirePermission("purchase:create")
  const parsed = purchaseSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> }
  }
  const input = parsed.data

  // Load firm, supplier and the referenced products (authoritative GST rates).
  const [firm, supplier, settings, location, products] = await Promise.all([
    prisma.firm.findUnique({ where: { id: firmId } }),
    prisma.supplier.findFirst({ where: { id: input.supplierId, firmId } }),
    prisma.setting.findUnique({ where: { firmId } }),
    prisma.location.findFirst({ where: { id: input.locationId, firmId } }),
    prisma.product.findMany({
      where: { id: { in: input.items.map((i) => i.productId) }, firmId },
      include: { taxGroup: true },
    }),
  ])
  if (!supplier) return { ok: false, error: "Supplier not found." }
  if (!location) return { ok: false, error: "Location not found." }

  const productMap = new Map(products.map((p) => [p.id, p]))
  for (const it of input.items) {
    if (!productMap.has(it.productId)) return { ok: false, error: "Invalid product in items." }
  }

  const treatment = resolveGstTreatment(firm?.stateCode, supplier.stateCode)

  // Build GST lines (server resolves the rate from each product's tax group).
  const gstLines = input.items.map((it) => {
    const product = productMap.get(it.productId)!
    const gstRate = toNumber(product.taxGroup?.gstRate)
    return {
      quantity: it.quantity,
      rate: it.rate,
      discountPct: it.discountPct,
      gstRate,
      cessRate: toNumber(product.taxGroup?.cessRate),
    }
  })
  const doc = computeDocument(gstLines, treatment)

  const isCash = input.paymentMode === "CASH"

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextDocNumber(tx, firmId, "purchaseInvoice", settings?.purchasePrefix ?? "PUR")

      const invoice = await tx.purchaseInvoice.create({
        data: {
          firmId,
          supplierId: supplier.id,
          locationId: location.id,
          invoiceNumber,
          supplierInvNo: input.supplierInvNo || null,
          invoiceDate: new Date(input.invoiceDate),
          dueDate: toDate(input.dueDate),
          status: isCash ? "PAID" : "CONFIRMED",
          paymentMode: input.paymentMode,
          gstTreatment: treatment,
          subtotal: doc.subtotal,
          discountAmount: doc.discountAmount,
          taxableAmount: doc.taxableAmount,
          cgstAmount: doc.cgstAmount,
          sgstAmount: doc.sgstAmount,
          igstAmount: doc.igstAmount,
          cessAmount: doc.cessAmount,
          roundOff: doc.roundOff,
          grandTotal: doc.grandTotal,
          paidAmount: isCash ? doc.grandTotal : 0,
          notes: input.notes || null,
          createdById: user.id,
        },
      })

      // Items + inventory batches + stock ledger.
      for (let i = 0; i < input.items.length; i++) {
        const it = input.items[i]
        const line = doc.lines[i]
        const product = productMap.get(it.productId)!
        const batchNumber = it.batchNumber?.trim() || `${invoiceNumber}-${i + 1}`
        const inwardQty = it.quantity + (it.freeQuantity ?? 0)

        await tx.purchaseInvoiceItem.create({
          data: {
            invoiceId: invoice.id,
            productId: product.id,
            batchNumber,
            mfgDate: toDate(it.mfgDate),
            expiryDate: toDate(it.expiryDate),
            quantity: it.quantity,
            freeQuantity: it.freeQuantity ?? 0,
            rate: it.rate,
            mrp: it.mrp ?? 0,
            discountPct: it.discountPct ?? 0,
            discountAmount: line.discountAmount,
            taxableAmount: line.taxableAmount,
            gstRate: line.gstRate,
            cgstAmount: line.cgstAmount,
            sgstAmount: line.sgstAmount,
            igstAmount: line.igstAmount,
            total: line.total,
          },
        })

        // Upsert batch (firm,product,location,batchNumber unique).
        const existingBatch = await tx.inventoryBatch.findUnique({
          where: {
            firmId_productId_locationId_batchNumber: {
              firmId, productId: product.id, locationId: location.id, batchNumber,
            },
          },
        })
        let batchId: string
        if (existingBatch) {
          const updated = await tx.inventoryBatch.update({
            where: { id: existingBatch.id },
            data: {
              quantity: { increment: inwardQty },
              purchaseRate: it.rate,
              mrp: it.mrp ?? toNumber(existingBatch.mrp),
              expiryDate: toDate(it.expiryDate) ?? existingBatch.expiryDate,
            },
          })
          batchId = updated.id
        } else {
          const created = await tx.inventoryBatch.create({
            data: {
              firmId, productId: product.id, locationId: location.id, batchNumber,
              mfgDate: toDate(it.mfgDate), expiryDate: toDate(it.expiryDate),
              quantity: inwardQty, purchaseRate: it.rate, mrp: it.mrp ?? 0,
              supplierId: supplier.id,
            },
          })
          batchId = created.id
        }

        // Stock ledger running balance for this product@location.
        const agg = await tx.inventoryBatch.aggregate({
          where: { firmId, productId: product.id, locationId: location.id },
          _sum: { quantity: true },
        })
        await tx.stockLedger.create({
          data: {
            firmId, productId: product.id, locationId: location.id, batchId,
            txnType: "PURCHASE", referenceType: "PURCHASE_INVOICE", referenceId: invoice.id,
            quantityIn: inwardQty, quantityOut: 0,
            balance: toNumber(agg._sum.quantity), rate: it.rate,
            createdById: user.id,
          },
        })
      }

      // Supplier ledger + balance.
      let bal = toNumber(supplier.balance)
      bal += doc.grandTotal
      await tx.supplierLedger.create({
        data: {
          firmId, supplierId: supplier.id, entryDate: new Date(input.invoiceDate),
          referenceType: "PURCHASE_INVOICE", referenceId: invoice.id,
          particulars: `Purchase ${invoiceNumber}`, entryType: "CREDIT",
          debit: 0, credit: doc.grandTotal, balance: bal,
        },
      })
      if (isCash) {
        bal -= doc.grandTotal
        await tx.supplierLedger.create({
          data: {
            firmId, supplierId: supplier.id, entryDate: new Date(input.invoiceDate),
            referenceType: "PURCHASE_INVOICE", referenceId: invoice.id,
            particulars: `Payment (cash) ${invoiceNumber}`, entryType: "DEBIT",
            debit: doc.grandTotal, credit: 0, balance: bal,
          },
        })
      }
      await tx.supplier.update({ where: { id: supplier.id }, data: { balance: bal } })

      return invoice
    })

    await logAudit({
      firmId, userId: user.id, action: "CREATE", entity: "PurchaseInvoice",
      entityId: result.id, newData: { invoiceNumber: result.invoiceNumber, grandTotal: doc.grandTotal },
    })
    revalidatePath("/purchases")
    revalidatePath("/inventory")
    return { ok: true, id: result.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create purchase." }
  }
}
