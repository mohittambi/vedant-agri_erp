# Agri Input ERP — Deployment & Setup Guide

Production-grade ERP for agri-input distribution.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
ShadCN UI · React Hook Form + Zod · TanStack Table · Recharts · Prisma 7 ·
Supabase (PostgreSQL · Auth · Storage · RLS).

> ⚠️ This project targets **Next.js 16** and **Prisma 7**, both of which have
> breaking changes vs. older majors. Key differences already handled in the
> codebase:
> - `params` / `searchParams` / `cookies()` are **async** (must be awaited).
> - Middleware is now **`src/proxy.ts`** (not `middleware.ts`).
> - Prisma connection URLs live in **`prisma.config.ts`** (not the schema), and
>   the client uses the **`@prisma/adapter-pg`** driver adapter.

---

## 1. Prerequisites

- Node.js ≥ 20 (tested on v24)
- A [Supabase](https://supabase.com) project (free tier is fine)

## 2. Configure environment

```bash
cp .env.example .env.local
```

Fill `.env.local` from your Supabase dashboard:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key (secret) |
| `DATABASE_URL` | Project Settings → Database → Connection string → **Transaction** pooler (port 6543), add `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Same screen → **Session** / direct connection (port 5432) |

To auto-provision a super admin during seeding, also set:

```dotenv
SEED_SUPER_ADMIN_EMAIL="admin@yourfirm.com"
SEED_SUPER_ADMIN_PASSWORD="a-strong-password"
```

## 3. Install dependencies

```bash
npm install      # also runs `prisma generate` via postinstall
```

## 4. Create the database schema (order matters)

```bash
# 4a. Create all tables/enums/indexes from the Prisma schema
npm run db:deploy        # = prisma migrate deploy
#    (first time on an empty DB you can use: npx prisma migrate dev --name init)

# 4b. Apply RLS, triggers, DB functions, auth sync & storage buckets
npm run db:sql           # runs supabase/sql/01..04 in order via DIRECT_URL

# 4c. Seed permissions, the 7 system roles, and (optionally) the super admin
npm run db:seed
```

What each SQL file does (`supabase/sql/`):

| File | Contents |
| --- | --- |
| `01_auth_and_helpers.sql` | Syncs `auth.users` → `public.users`; RLS helpers `is_super_admin()`, `user_in_firm()` |
| `02_rls_policies.sql` | Row Level Security on every table (multi-firm isolation) |
| `03_triggers_functions.sql` | `updated_at`, **cash<credit** rule, `available_stock()`, `fifo_allocate()`, non-negative stock guard |
| `04_storage.sql` | The 5 storage buckets + access policies |

## 5. Run

```bash
npm run dev      # http://localhost:3000
```

Sign in with the super-admin credentials from step 2. From there: create a Firm,
add Locations / Tax Groups / Categories / Manufacturers / Products, then start
transacting.

---

## Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:migrate` | Create a new migration (`prisma migrate dev`) |
| `npm run db:deploy` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:sql` | (Re)apply the SQL policy/trigger/storage files |
| `npm run db:seed` | Seed roles/permissions/super-admin |
| `npm run db:studio` | Prisma Studio (DB browser) |

---

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import into Vercel. Framework preset: **Next.js**.
3. Add every variable from `.env.local` to Vercel → Settings → Environment Variables.
4. Build command stays `next build`; the `postinstall` runs `prisma generate`.
5. Run `npm run db:deploy && npm run db:sql && npm run db:seed` once against the
   production database (locally with prod creds, or via a CI step).

### Security model (read this)

- **Prisma** connects as the `postgres` role and **bypasses RLS**. Multi-firm
  isolation for all ORM access is enforced in application code via
  `src/lib/auth.ts` (`requireFirm`, `requirePermission`) — every query is scoped
  to the authenticated user's active firm.
- **RLS** is defence-in-depth for any access through the `anon` / `authenticated`
  keys: Supabase Realtime, Storage, and direct PostgREST.
- The `service_role` key is **server-only** (used for admin operations like
  creating auth users). Never expose it to the browser.

---

## Roadmap (modules)

Built so far: foundation, auth + RBAC (7 roles), multi-firm switching, dashboard,
GST engine, full schema + RLS + triggers, storage. See the in-app sidebar for the
full module map. Remaining modules (masters CRUD, inventory/FIFO, purchase, sales,
ledgers, vouchers, reports, PDF/Excel/WhatsApp, audit) are layered on top of the
shared `requirePermission` + DataTable + server-action pattern.
