"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { customerSchema, supplierSchema, type PartyInput } from "@/lib/validations/party"
import { STATE_BY_CODE } from "@/lib/india"
import type { ActionResult } from "@/lib/actions/firm-actions"
import type { Permission } from "@/lib/constants"

export type PartyKind = "customer" | "supplier"

function cfg(kind: PartyKind) {
  return kind === "customer"
    ? { schema: customerSchema, route: "/customers", resource: "customer", label: "Customer", delegate: prisma.customer }
    : { schema: supplierSchema, route: "/suppliers", resource: "supplier", label: "Supplier", delegate: prisma.supplier }
}

function clean(values: PartyInput) {
  const nz = (v?: string) => (v && v.length ? v : null)
  return {
    name: values.name.trim(),
    phone: nz(values.phone),
    email: nz(values.email),
    gstin: nz(values.gstin?.toUpperCase()),
    address: nz(values.address),
    city: nz(values.city),
    stateCode: nz(values.stateCode),
    state: values.stateCode ? (STATE_BY_CODE.get(values.stateCode) ?? null) : null,
    openingBalance: values.openingBalance,
  }
}

export async function saveParty(
  kind: PartyKind,
  id: string | null,
  values: PartyInput
): Promise<ActionResult> {
  const c = cfg(kind)
  const { user, firmId } = await requirePermission(
    `${c.resource}:${id ? "update" : "create"}` as Permission
  )
  const parsed = c.schema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> }
  }

  const values2 = parsed.data as unknown as PartyInput
  const common = clean(values2)
  const data =
    kind === "customer"
      ? { ...common, creditLimit: values2.creditLimit ?? 0 }
      : common

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = c.delegate as any
    if (id) {
      const before = await delegate.findFirst({ where: { id, firmId } })
      if (!before) return { ok: false, error: `${c.label} not found.` }
      // On create we set balance = openingBalance; on edit keep balance as-is
      // unless openingBalance changed the opening — keep simple: don't touch balance.
      await delegate.update({ where: { id }, data })
      await logAudit({ firmId, userId: user.id, action: "UPDATE", entity: c.label, entityId: id, oldData: JSON.parse(JSON.stringify(before)), newData: data })
      revalidatePath(c.route)
      return { ok: true, id }
    }
    const created = await delegate.create({
      data: { ...data, firmId, balance: data.openingBalance },
    })
    await logAudit({ firmId, userId: user.id, action: "CREATE", entity: c.label, entityId: created.id, newData: data })
    revalidatePath(c.route)
    return { ok: true, id: created.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." }
  }
}

export async function toggleParty(
  kind: PartyKind,
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const c = cfg(kind)
  const { user, firmId } = await requirePermission(`${c.resource}:update` as Permission)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = c.delegate as any
  const existing = await delegate.findFirst({ where: { id, firmId } })
  if (!existing) return { ok: false, error: `${c.label} not found.` }
  await delegate.update({ where: { id }, data: { isActive } })
  await logAudit({ firmId, userId: user.id, action: "UPDATE", entity: c.label, entityId: id, newData: { isActive } })
  revalidatePath(c.route)
  return { ok: true, id }
}
