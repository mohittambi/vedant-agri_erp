/**
 * Database seed.
 *  - Upserts the permission catalogue (idempotent)
 *  - Upserts the 7 system roles + their permission matrix
 *  - Optionally provisions a demo firm + super-admin auth user when
 *    SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD are set AND Supabase
 *    credentials are real.
 *
 *   npm run db:seed
 */
import { config as loadEnv } from "dotenv"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import {
  ALL_PERMISSIONS,
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type RoleKey,
} from "../src/lib/constants"

loadEnv({ path: ".env.local" })
loadEnv({ path: ".env" })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function seedPermissions() {
  console.log(`Seeding ${ALL_PERMISSIONS.length} permissions...`)
  for (const key of ALL_PERMISSIONS) {
    const [resource, action] = key.split(":")
    await prisma.permission.upsert({
      where: { key },
      update: { resource, action },
      create: { key, resource, action },
    })
  }
}

async function seedSystemRoles() {
  console.log("Seeding system roles + permission matrix...")
  const permissions = await prisma.permission.findMany()
  const permByKey = new Map(permissions.map((p) => [p.key, p.id]))

  for (const key of Object.keys(ROLES) as RoleKey[]) {
    // NULL is distinct in unique constraints, so upsert-by-(firmId,key) is
    // unreliable for system roles. Find-or-create by hand instead.
    const existing = await prisma.role.findFirst({ where: { firmId: null, key } })
    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: { name: ROLE_LABELS[key], isSystem: true },
        })
      : await prisma.role.create({
          data: { firmId: null, key, name: ROLE_LABELS[key], isSystem: true },
        })

    // Reset + reassign permissions for this system role.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
    const wanted = ROLE_PERMISSIONS[key]
    await prisma.rolePermission.createMany({
      data: wanted
        .map((pk) => permByKey.get(pk))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    })
    console.log(`  • ${ROLE_LABELS[key]} → ${wanted.length} permissions`)
  }
}

async function seedSuperAdmin() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!email || !password) {
    console.log(
      "\nℹ Skipping super-admin: set SEED_SUPER_ADMIN_EMAIL & SEED_SUPER_ADMIN_PASSWORD to provision one."
    )
    return
  }
  if (!url || !serviceKey || url.includes("YOUR-") || serviceKey.includes("your-")) {
    console.log("\nℹ Skipping super-admin: real Supabase credentials required.")
    return
  }

  const { createClient } = await import("@supabase/supabase-js")
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`\nProvisioning super admin ${email}...`)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Super Admin", is_super_admin: true },
  })

  let userId = data?.user?.id
  if (error && !userId) {
    // Maybe already exists — look it up.
    const { data: list } = await admin.auth.admin.listUsers()
    userId = list?.users.find((u) => u.email === email)?.id
    if (!userId) {
      console.warn("  ! Could not create or find auth user:", error.message)
      return
    }
  }

  // The on_auth_user_created trigger creates public.users; ensure the flag.
  await prisma.user.update({
    where: { id: userId! },
    data: { isSuperAdmin: true, fullName: "Super Admin", isActive: true },
  })
  console.log("  ✓ Super admin ready.")
}

async function main() {
  await seedPermissions()
  await seedSystemRoles()
  await seedSuperAdmin()
  console.log("\n✅ Seed complete.")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
