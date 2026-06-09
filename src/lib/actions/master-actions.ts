"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePermission, userHasPermission, requireFirm } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { MASTER_CONFIGS, type MasterModel } from "@/lib/master"
import type { Action, Permission } from "@/lib/constants"

export type ActionResult = {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  id?: string
}

// Map a master model to its Prisma delegate (typed loosely — fields vary).
function delegate(model: MasterModel) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[model]
}

function perm(model: MasterModel, action: Action): Permission {
  return `${MASTER_CONFIGS[model].resource}:${action}` as Permission
}

function friendlyError(err: unknown): string {
  const e = err as { code?: string; meta?: { target?: string[] } }
  if (e?.code === "P2002") {
    return `A record with this ${e.meta?.target?.join(", ") ?? "value"} already exists.`
  }
  return err instanceof Error ? err.message : "Something went wrong."
}

export async function saveMasterItem(
  model: MasterModel,
  id: string | null,
  values: unknown
): Promise<ActionResult> {
  const config = MASTER_CONFIGS[model]
  const { user, firmId } = await requirePermission(
    perm(model, id ? "update" : "create")
  )

  const parsed = config.schema.safeParse(values)
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }

  // Normalise empty strings → null.
  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
    data[k] = v === "" ? null : v
  }

  try {
    let resultId: string
    if (id) {
      const before = await delegate(model).findFirst({ where: { id, firmId } })
      if (!before) return { ok: false, error: "Record not found." }
      const updated = await delegate(model).update({ where: { id }, data })
      resultId = updated.id
      await logAudit({
        firmId, userId: user.id, action: "UPDATE",
        entity: config.title, entityId: id,
        oldData: JSON.parse(JSON.stringify(before)), newData: data,
      })
    } else {
      const created = await delegate(model).create({ data: { ...data, firmId } })
      resultId = created.id
      await logAudit({
        firmId, userId: user.id, action: "CREATE",
        entity: config.title, entityId: resultId, newData: data,
      })
    }
    revalidatePath(config.route)
    return { ok: true, id: resultId }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
}

export async function toggleMasterItem(
  model: MasterModel,
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const config = MASTER_CONFIGS[model]
  const { user, firmId } = await requirePermission(perm(model, "update"))
  try {
    const existing = await delegate(model).findFirst({ where: { id, firmId } })
    if (!existing) return { ok: false, error: "Record not found." }
    await delegate(model).update({ where: { id }, data: { isActive } })
    await logAudit({
      firmId, userId: user.id, action: "UPDATE",
      entity: config.title, entityId: id, newData: { isActive },
    })
    revalidatePath(config.route)
    return { ok: true, id }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
}

export async function deleteMasterItem(
  model: MasterModel,
  id: string
): Promise<ActionResult> {
  const config = MASTER_CONFIGS[model]
  const { user, firmId } = await requirePermission(perm(model, "delete"))
  try {
    const existing = await delegate(model).findFirst({ where: { id, firmId } })
    if (!existing) return { ok: false, error: "Record not found." }
    await delegate(model).delete({ where: { id } })
    await logAudit({
      firmId, userId: user.id, action: "DELETE",
      entity: config.title, entityId: id,
      oldData: JSON.parse(JSON.stringify(existing)),
    })
    revalidatePath(config.route)
    return { ok: true }
  } catch (err) {
    // FK constraint → in use elsewhere.
    const e = err as { code?: string }
    if (e?.code === "P2003") {
      return { ok: false, error: "Cannot delete — this record is in use." }
    }
    return { ok: false, error: friendlyError(err) }
  }
}

/** Used by the page to decide whether to show write controls. */
export async function masterCan(model: MasterModel, action: Action): Promise<boolean> {
  const { user } = await requireFirm()
  return userHasPermission(user, perm(model, action))
}
