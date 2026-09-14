import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

/**
 * Prisma 7 client using the node-postgres driver adapter.
 *
 * Works across three runtimes:
 *  - Local / Vercel (Node)   → reads process.env.DATABASE_URL
 *  - Cloudflare Workers      → reads the Hyperdrive binding's connectionString
 *    (falls back to process.env.DATABASE_URL, which nodejs_compat populates
 *    from Worker secrets).
 *
 * The client is created LAZILY on first use via a Proxy, so on Workers the
 * connection string is resolved inside request scope (where bindings are
 * available) rather than at module-eval time.
 *
 * SECURITY: Prisma connects with the `postgres` role and BYPASSES RLS.
 * Multi-firm isolation for ORM access is enforced in app code (lib/auth.ts).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Supavisor pooler host for this project's Supabase database. The direct
// host `db.<ref>.supabase.co` is IPv6-only and is therefore unreachable from
// Vercel's IPv4 serverless functions (Prisma P1001 "Can't reach database
// server"). On Vercel we transparently rewrite a direct connection string to
// the IPv4-friendly transaction pooler so no env-var change is required.
//
// The host is region-specific (`aws-<n>-<region>.pooler.supabase.com`) and must
// match whichever Supabase project DATABASE_URL points at — a mismatch fails
// with "Tenant or user not found", not a DNS error. Set SUPABASE_POOLER_HOST to
// override without a code change; the default tracks the current project.
const SUPABASE_POOLER_HOST =
  process.env.SUPABASE_POOLER_HOST || "aws-0-ap-northeast-1.pooler.supabase.com"

/**
 * Rewrite a Supabase *direct* connection string to the Supavisor transaction
 * pooler. No-op for any URL that isn't a direct Supabase host. The password
 * and database are preserved; only host, port and the pooler-style username
 * (`postgres.<ref>`) change.
 */
function toSupabasePoolerUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    const m = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname)
    if (!m) return connectionString
    const ref = m[1]
    url.hostname = SUPABASE_POOLER_HOST
    url.port = "6543"
    if (url.username === "postgres") url.username = `postgres.${ref}`
    return url.toString()
  } catch {
    return connectionString
  }
}

function resolveConnectionString(): string | undefined {
  // Prefer Cloudflare Hyperdrive when running on Workers.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@opennextjs/cloudflare") as {
      getCloudflareContext?: () => { env?: Record<string, { connectionString?: string }> }
    }
    const cs = mod.getCloudflareContext?.().env?.HYPERDRIVE?.connectionString
    if (cs) return cs
  } catch {
    // Not on Cloudflare (local, Vercel, tsx scripts) — ignore.
  }
  const direct = process.env.DATABASE_URL
  // On Vercel serverless, force the IPv4 transaction pooler.
  if (direct && process.env.VERCEL) return toSupabasePoolerUrl(direct)
  return direct
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: resolveConnectionString() })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrismaClient()
  return globalForPrisma.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value
  },
}) as PrismaClient
