import { config as loadEnv } from "dotenv"
import { defineConfig, env } from "prisma/config"

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
    // DIRECT (5432) connection — Supabase manages migrations on the same DB;
    // no separate shadow database is available, so we don't configure one.
    url: env("DIRECT_URL"),
  },
})
