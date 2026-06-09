"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { requireAuth, ACTIVE_FIRM_COOKIE } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { firmSchema, type FirmInput } from "@/lib/validations/firm"
import { STATE_BY_CODE } from "@/lib/india"

export type ActionResult = {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  id?: string
}

/** Firms are global tenancy objects — only a Super Admin may manage them. */
async function requireSuperAdmin() {
  const user = await requireAuth()
  if (!user.isSuperAdmin) {
    throw new Error("Forbidden: only a Super Admin can manage firms.")
  }
  return user
}

function clean(input: FirmInput) {
  const empty = (v?: string) => (v && v.length ? v : null)
  return {
    name: input.name.trim(),
    legalName: empty(input.legalName),
    gstin: empty(input.gstin?.toUpperCase()),
    pan: empty(input.pan?.toUpperCase()),
    stateCode: empty(input.stateCode),
    state: input.stateCode ? (STATE_BY_CODE.get(input.stateCode) ?? null) : empty(input.state),
    address: empty(input.address),
    city: empty(input.city),
    pincode: empty(input.pincode),
    phone: empty(input.phone),
    email: empty(input.email),
    isActive: input.isActive,
  }
}

export async function createFirmAction(input: FirmInput): Promise<ActionResult> {
  const user = await requireSuperAdmin()
  const parsed = firmSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z_flatten(parsed.error) }
  }

  const data = clean(parsed.data)

  const firm = await prisma.$transaction(async (tx) => {
    const created = await tx.firm.create({ data })
    // Sensible defaults so the firm is immediately usable.
    await tx.setting.create({ data: { firmId: created.id } })
    await tx.location.create({
      data: {
        firmId: created.id,
        name: "Main Store",
        code: "MAIN",
        type: "STORE",
        isDefault: true,
      },
    })
    return created
  })

  // First firm for this super admin → make it the default + active.
  if (user.firms.length === 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { defaultFirmId: firm.id },
    })
    const jar = await cookies()
    jar.set(ACTIVE_FIRM_COOKIE, firm.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  await logAudit({
    firmId: firm.id,
    userId: user.id,
    action: "CREATE",
    entity: "Firm",
    entityId: firm.id,
    newData: data,
  })

  revalidatePath("/firms")
  revalidatePath("/", "layout")
  return { ok: true, id: firm.id }
}

export async function updateFirmAction(
  id: string,
  input: FirmInput
): Promise<ActionResult> {
  const user = await requireSuperAdmin()
  const parsed = firmSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z_flatten(parsed.error) }
  }

  const before = await prisma.firm.findUnique({ where: { id } })
  if (!before) return { ok: false, error: "Firm not found." }

  const data = clean(parsed.data)
  await prisma.firm.update({ where: { id }, data })

  await logAudit({
    firmId: id,
    userId: user.id,
    action: "UPDATE",
    entity: "Firm",
    entityId: id,
    oldData: JSON.parse(JSON.stringify(before)),
    newData: data,
  })

  revalidatePath("/firms")
  revalidatePath("/", "layout")
  return { ok: true, id }
}

export async function toggleFirmActiveAction(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const user = await requireSuperAdmin()
  await prisma.firm.update({ where: { id }, data: { isActive } })
  await logAudit({
    firmId: id,
    userId: user.id,
    action: "UPDATE",
    entity: "Firm",
    entityId: id,
    newData: { isActive },
  })
  revalidatePath("/firms")
  revalidatePath("/", "layout")
  return { ok: true, id }
}

// Local helper to keep Zod flatten typing tidy.
function z_flatten(err: z.ZodError): Record<string, string[]> {
  return z.flattenError(err).fieldErrors as Record<string, string[]>
}
