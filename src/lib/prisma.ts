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
  return process.env.DATABASE_URL
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
