/**
 * Applies the raw SQL files in supabase/sql/ in order, using a DIRECT
 * (non-pooled) connection. Run AFTER `prisma migrate deploy`.
 *
 *   npm run db:sql
 */
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { config as loadEnv } from "dotenv"
import { Client } from "pg"

loadEnv({ path: ".env.local" })
loadEnv({ path: ".env" })

const SQL_DIR = join(process.cwd(), "supabase", "sql")

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!connectionString || connectionString.includes("YOUR-")) {
    throw new Error(
      "DIRECT_URL / DATABASE_URL is not configured with real credentials in .env.local"
    )
  }

  const files = readdirSync(SQL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  const client = new Client({ connectionString })
  await client.connect()
  console.log(`Connected. Applying ${files.length} SQL file(s)...\n`)

  try {
    for (const file of files) {
      const sql = readFileSync(join(SQL_DIR, file), "utf8")
      process.stdout.write(`  → ${file} ... `)
      await client.query(sql)
      console.log("done")
    }
    console.log("\n✅ All SQL applied successfully.")
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error("\n❌ Failed to apply SQL:", err.message)
  process.exit(1)
})
