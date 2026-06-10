"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/audit"
import {
  createUserSchema, updateUserSchema, setPasswordSchema,
  type CreateUserInput, type UpdateUserInput, type SetPasswordInput,
} from "@/lib/validations/user"
import type { ActionResult } from "@/lib/actions/firm-actions"

export async function createUser(values: CreateUserInput): Promise<ActionResult> {
  const { user: actor, firmId } = await requirePermission("user:create")
  const parsed = createUserSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> }
  }
  const input = parsed.data

  // Resolve the system role to assign.
  const role = await prisma.role.findFirst({ where: { firmId: null, key: input.roleKey } })
  if (!role) return { ok: false, error: "Role not found. Seed system roles first." }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  })

  let userId = data?.user?.id
  if (error || !userId) {
    // Maybe the auth user already exists — link them instead.
    const { data: list } = await admin.auth.admin.listUsers()
    userId = list?.users.find((u) => u.email === input.email)?.id
    if (!userId) return { ok: false, error: error?.message ?? "Could not create user." }
  }

  try {
    // The on_auth_user_created trigger inserts public.users; ensure fields + role.
    await prisma.user.upsert({
      where: { id: userId },
      update: { fullName: input.fullName, isActive: true },
      create: { id: userId, email: input.email, fullName: input.fullName },
    })
    await prisma.userRole.upsert({
      where: { userId_firmId_roleId: { userId, firmId, roleId: role.id } },
      update: {},
      create: { userId, firmId, roleId: role.id },
    })
    // Default firm if none set.
    await prisma.user.updateMany({ where: { id: userId, defaultFirmId: null }, data: { defaultFirmId: firmId } })

    await logAudit({ firmId, userId: actor.id, action: "CREATE", entity: "User", entityId: userId, newData: { email: input.email, role: input.roleKey } })
    revalidatePath("/users")
    return { ok: true, id: userId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to assign role." }
  }
}

export async function updateUser(values: UpdateUserInput): Promise<ActionResult> {
  const { user: actor, firmId } = await requirePermission("user:update")
  const parsed = updateUserSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> }
  }
  const input = parsed.data

  // Only allow editing users that belong to this firm.
  const inFirm = await prisma.userRole.findFirst({ where: { userId: input.userId, firmId } })
  if (!inFirm) return { ok: false, error: "User not in this firm." }

  const role = await prisma.role.findFirst({ where: { firmId: null, key: input.roleKey } })
  if (!role) return { ok: false, error: "Role not found. Seed system roles first." }

  try {
    await prisma.user.update({ where: { id: input.userId }, data: { fullName: input.fullName } })
    // Replace this firm's role assignment with the chosen one.
    await prisma.userRole.deleteMany({ where: { userId: input.userId, firmId } })
    await prisma.userRole.create({ data: { userId: input.userId, firmId, roleId: role.id } })

    await logAudit({ firmId, userId: actor.id, action: "UPDATE", entity: "User", entityId: input.userId, newData: { fullName: input.fullName, role: input.roleKey } })
    revalidatePath("/users")
    return { ok: true, id: input.userId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update user." }
  }
}

export async function setUserPassword(values: SetPasswordInput): Promise<ActionResult> {
  const { user: actor, firmId } = await requirePermission("user:update")
  const parsed = setPasswordSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> }
  }
  const input = parsed.data

  const inFirm = await prisma.userRole.findFirst({ where: { userId: input.userId, firmId } })
  if (!inFirm) return { ok: false, error: "User not in this firm." }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(input.userId, { password: input.password })
  if (error) return { ok: false, error: error.message }

  await logAudit({ firmId, userId: actor.id, action: "UPDATE", entity: "User", entityId: input.userId, newData: { passwordReset: true } })
  return { ok: true }
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<ActionResult> {
  const { user: actor, firmId } = await requirePermission("user:update")
  if (userId === actor.id) return { ok: false, error: "You cannot deactivate yourself." }
  // Only allow toggling users that belong to this firm.
  const inFirm = await prisma.userRole.findFirst({ where: { userId, firmId } })
  if (!inFirm) return { ok: false, error: "User not in this firm." }
  await prisma.user.update({ where: { id: userId }, data: { isActive } })
  await logAudit({ firmId, userId: actor.id, action: "UPDATE", entity: "User", entityId: userId, newData: { isActive } })
  revalidatePath("/users")
  return { ok: true }
}
