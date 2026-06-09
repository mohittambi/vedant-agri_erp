import { config as loadEnv } from "dotenv"
import { defineConfig } from "prisma/config"

// Next.js stores secrets in `.env.local`; Prisma CLI defaults to `.env`.
// Load both so a single source of truth works for migrations and runtime.
loadEnv({ path: ".env.local" })
loadEnv({ path: ".env" })

/**
 * Prisma 7 configuration.
 * Connection URLs moved out of schema.prisma into this file.
 * - DATABASE_URL : pooled runtime connection (pgBouncer, port 6543)
 * - DIRECT_URL   : direct connection used as the shadow/migration DB (port 5432)
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations use the DIRECT (5432) connection; fall back to DATABASE_URL.
    // Plain process.env (not env()) so `prisma generate` in CI / Vercel builds
    // never throws when the URL isn't present (generate doesn't need a DB).
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
})
