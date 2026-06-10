# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> Next.js 16 / Prisma 7 / Tailwind v4 in this repo have breaking changes vs. older training data.
> When an API surprises you, read `node_modules/next/dist/docs/` (per AGENTS.md) rather than guessing.

## Commands

```bash
npm run dev            # Next dev server (Turbopack) on http://localhost:3000
npm run build          # production build
npm run lint           # eslint

# Database (Prisma = table DDL; SQL files = RLS/triggers/functions/storage)
npm run db:deploy      # prisma migrate deploy  (create/update schema)
npm run db:push        # prisma db push          (prototype without a migration)
npm run db:sql         # apply supabase/sql/*.sql IN ORDER — run AFTER db:deploy
npm run db:seed        # roles, permissions, super admin (prisma/seed.ts)
npm run db:demo        # optional fully-populated demo firm (scripts/demo-seed.ts)
npm run db:studio      # Prisma Studio
npm run db:generate    # regenerate Prisma client (also runs on postinstall)

# Cloudflare Workers (OpenNext) — alternative to Vercel
npm run cf:preview     # build + local preview
npm run cf:deploy      # build + deploy to Workers
```

First-time setup order matters: `db:deploy` → `db:sql` → `db:seed` (→ `db:demo`). See `DEPLOYMENT.md`
and `CLOUDFLARE.md`. There is no test runner configured.

## Architecture

Multi-firm ERP for agri-input distribution: inventory (FIFO + batch/expiry), GST billing
(CGST/SGST vs IGST), purchases, sales, returns, ledgers, vouchers, reports, analytics.

### Two-layer database (important)
- **Prisma schema** (`prisma/schema.prisma`) is the source of truth for **table DDL only**, applied
  via `prisma migrate`. Field naming: camelCase in TS, `@map` to snake_case columns. Money =
  `Decimal(14,2)`, quantity = `Decimal(14,3)`, percent = `Decimal(6,3)`, ids = UUID.
- **Raw SQL** (`supabase/sql/01..04`) holds **RLS policies, triggers, DB functions, storage buckets**,
  applied separately by `npm run db:sql` (`scripts/apply-sql.ts`, direct non-pooled connection)
  **after** migrations. Business rules like "cash rate < credit rate" exist as both a Zod check and a
  DB trigger — change both.

### Tenancy & security model (important)
- Prisma connects as the `postgres` role and **BYPASSES RLS** (`src/lib/prisma.ts`). Multi-firm
  isolation for all ORM access is therefore enforced **in application code**, not by the database.
  RLS is defense-in-depth for the anon/authenticated Supabase keys only.
- **Every query must be scoped to the active firm.** Use `requirePermission()` / `requireFirm()` from
  `src/lib/auth.ts`, then constrain reads/writes with `firmId` (and prefer `findFirst({ where: { id, firmId } })`
  over `findUnique({ where: { id } })` for tenant-owned rows). Never trust a client-supplied `firmId`.
- Auth/session lives in `src/lib/auth.ts`: `getCurrentUser()` (React-`cache`d per request) hydrates the
  user, their firms, the active firm (from `ACTIVE_FIRM_COOKIE`, falling back to default/first), and the
  aggregated permission set **for the active firm only**. `SUPER_ADMIN` is special-cased to all-access
  across all firms.
- RBAC permissions are `` `${resource}:${action}` `` strings (`src/lib/constants.ts`,
  `ALL_PERMISSIONS`); `ROLE_PERMISSIONS` is the seedable matrix. Pages pre-check with
  `userHasPermission`; server actions gate with `requirePermission("sales:create")`.

### Canonical server-action pattern
Mutations live in `src/lib/actions/*-actions.ts` (`"use server"`). Follow the existing shape:
1. `const { user, firmId } = await requirePermission("<resource>:<action>")`
2. Validate input with the matching `src/lib/validations/*` Zod schema; return
   `{ ok:false, fieldErrors }` on failure (shared `ActionResult` type from `firm-actions.ts`).
3. Do the work inside `prisma.$transaction(...)`, scoped to `firmId`.
4. `await logAudit({ firmId, userId, action, entity, ... })` — best-effort, never throws into the caller
   (`src/lib/audit.ts`).
5. `revalidatePath(...)` the affected routes.

### Reusable primitives — prefer these over new abstractions
- **GST engine** `src/lib/gst.ts` — pure functions (`resolveGstTreatment`, `computeDocument`). All tax math
  goes through here; intra-state → CGST+SGST, inter-state → IGST, decided by firm vs. party `stateCode`.
- **Master-CRUD engine** `src/lib/master/index.ts` (`MASTER_CONFIGS`) + `<MasterCrud>` + generic
  `master-actions.ts` — flat firm-scoped masters (category, manufacturer, taxGroup, location) are declared
  once, not hand-coded. Add new simple masters here.
- **Generic table** `src/components/data-table/data-table.tsx` (TanStack Table).
- Doc numbering: `src/lib/actions/doc-number.ts` (`nextDocNumber`). India helpers: `src/lib/india.ts`,
  formatting: `src/lib/format.ts` (`toNumber` for Prisma Decimal → number).

### Routing
- `src/app/(app)/*` — authenticated ERP screens (one folder per module). Pages are server components that
  call `requireFirm`/`requirePermission`; interactive parts are split into `*-client.tsx` / `*-form.tsx`.
- `src/app/(auth)/*` — login.
- `src/app/api/*` — route handlers for things that aren't form mutations: PDF (`/sales/[id]/pdf`,
  `pdf-lib`), Excel `/export/[entity]` & `/products/import` (`exceljs`), WhatsApp `/sales/[id]/whatsapp`.

### Runtime / deploy notes
- Prisma uses the `@prisma/adapter-pg` driver adapter and a **lazy Proxy** client so the connection string
  is resolved in request scope — Cloudflare Hyperdrive binding when on Workers, else `DATABASE_URL`.
  Don't replace the Proxy with an eager client.
- Deploys go GitHub → Vercel (auto) **or** Cloudflare Workers via `cf:deploy`. Env vars are set in the
  dashboard, not committed (`.env.example`, `.dev.vars.example`).
