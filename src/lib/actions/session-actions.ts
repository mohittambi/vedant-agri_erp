"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, ACTIVE_FIRM_COOKIE } from "@/lib/auth"

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

/** Switch the active firm (validated against the user's accessible firms). */
export async function switchFirmAction(firmId: string) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const allowed = user.firms.some((f) => f.id === firmId)
  if (!allowed) throw new Error("You do not have access to that firm.")

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_FIRM_COOKIE, firmId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath("/", "layout")
}
