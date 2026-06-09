import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Next.js 16: `cookies()` is async and must be awaited.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware/proxy refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Privileged client using the service-role key. SERVER ONLY.
 * Bypasses RLS — use exclusively for admin operations such as creating
 * auth users, never expose to the browser.
 */
export function createAdminClient() {
  const { createClient: createSupabaseClient } =
    require("@supabase/supabase-js") as typeof import("@supabase/supabase-js")

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}
