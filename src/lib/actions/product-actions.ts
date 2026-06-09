"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { productSchema, type ProductInput } from "@/lib/validations/product"
import type { ActionResult } from "@/lib/actions/firm-actions"

function normalize(input: ProductInput, firmId: string) {
  const nullIfEmpty = (v?: string) => (v && v.length ? v : null)
  return {
    firmId,
    sku: input.sku.trim(),
    name: input.name.trim(),
    hsnCode: nullIfEmpty(input.hsnCode),
    unit: input.unit,
    categoryId: nullIfEmpty(input.categoryId),
    manufacturerId: nullIfEmpty(input.manufacturerId),
    taxGroupId: nullIfEmpty(input.taxGroupId),
    cashRate: input.cashRate,
    creditRate: input.creditRate,
    mrp: input.mrp,
    purchaseRate: input.purchaseRate,
    reorderLevel: input.reorderLevel,
    isBatchTracked: input.isBatchTracked,
    isActive: input.isActive,
  }
}

function friendly(err: unknown): string {
  const e = err as { code?: string; meta?: { target?: string[] }; message?: string }
  if (e?.code === "P2002") return "A product with this SKU already exists."
  // DB trigger raises check_violation for cash >= credit.
  if (e?.message?.toLowerCase().includes("cash rate"))
    return "Cash rate must be strictly less than credit rate."
  return e?.message ?? "Something went wrong."
}

export async function saveProduct(
  id: string | null,
  values: ProductInput
): Promise<ActionResult> {
  const { user, firmId } = await requirePermission(id ? "product:update" : "product:create")
  const parsed = productSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> }
  }

  const data = normalize(parsed.data, firmId)
  try {
    if (id) {
      const before = await prisma.product.findFirst({ where: { id, firmId } })
      if (!before) return { ok: false, error: "Product not found." }
      const { firmId: _f, ...update } = data
      void _f
      await prisma.product.update({ where: { id }, data: update })
      await logAudit({ firmId, userId: user.id, action: "UPDATE", entity: "Product", entityId: id, oldData: JSON.parse(JSON.stringify(before)), newData: update })
      revalidatePath("/products")
      return { ok: true, id }
    }
    const created = await prisma.product.create({ data })
    await logAudit({ firmId, userId: user.id, action: "CREATE", entity: "Product", entityId: created.id, newData: data })
    revalidatePath("/products")
    return { ok: true, id: created.id }
  } catch (err) {
    return { ok: false, error: friendly(err) }
  }
}

export async function toggleProduct(id: string, isActive: boolean): Promise<ActionResult> {
  const { user, firmId } = await requirePermission("product:update")
  const existing = await prisma.product.findFirst({ where: { id, firmId } })
  if (!existing) return { ok: false, error: "Product not found." }
  await prisma.product.update({ where: { id }, data: { isActive } })
  await logAudit({ firmId, userId: user.id, action: "UPDATE", entity: "Product", entityId: id, newData: { isActive } })
  revalidatePath("/products")
  return { ok: true, id }
}
