"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  redirectTo: z.string().optional(),
})

export type LoginState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function signInAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") || undefined,
  })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: error.message }
  }

  // Best-effort: record last login (non-blocking on failure).
  if (data.user) {
    await prisma.user
      .update({ where: { id: data.user.id }, data: { lastLoginAt: new Date() } })
      .catch(() => {})
  }

  const dest = parsed.data.redirectTo?.startsWith("/")
    ? parsed.data.redirectTo
    : "/dashboard"
  redirect(dest)
}
