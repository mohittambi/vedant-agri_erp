# Agri Input ERP 🌱

A production-grade, multi-firm ERP for **agri-input distribution** — inventory with
FIFO + batch/expiry tracking, GST billing (CGST/SGST/IGST), purchases, sales,
ledgers, vouchers, reports and analytics.

## Tech stack

- **Next.js 16** (App Router, Turbopack, Server Actions) · **React 19** · **TypeScript**
- **Tailwind v4** · **ShadCN UI** · **React Hook Form + Zod** · **TanStack Table** · **Recharts**
- **Prisma 7** (driver adapter) · **Supabase** (PostgreSQL · Auth · Storage · RLS)
- PDF invoices (pdf-lib) · Excel import/export (exceljs) · WhatsApp (wa.me / Cloud API)
- Deployable to **Cloudflare Workers** (OpenNext) or Vercel

## Features (30 modules)

Dashboard · Multi-firm · Users · **Role-based access (7 roles, 125 permissions)** ·
Locations · Products · Categories · Manufacturers · Tax Groups ·
**Inventory (FIFO, multi-location)** · Batches · **Expiry tracking** ·
**Purchases** + returns · **Sales** + returns · Customers · Suppliers ·
Customer/Supplier ledgers · Vouchers · **GST engine** · GST & P&L reports ·
Analytics · Audit trail · Notifications · PDF invoices · Excel import/export.

### Business rules enforced
- Cash rate **<** credit rate (Zod + DB trigger)
- FIFO inventory consumption · expired stock cannot be sold · real-time stock check
- Automatic CGST/SGST vs IGST · complete audit logging · strict multi-firm isolation

## Quick start

```bash
cp .env.example .env.local        # fill in Supabase credentials
npm install
npm run db:deploy                 # create schema (or: npx prisma db push)
npm run db:sql                    # RLS, triggers, functions, storage buckets
npm run db:seed                   # roles, permissions, super admin
npm run db:demo                   # optional: a fully-populated demo firm
npm run dev                       # http://localhost:3000
```

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for full setup and **[CLOUDFLARE.md](CLOUDFLARE.md)**
for Cloudflare Workers deployment.

## Architecture

- Every server action: `requirePermission()` → DB transaction → audit log, scoped to
  the authenticated user's active firm.
- Reusable primitives: generic `DataTable`, master-CRUD engine, shared invoice/ledger/
  return components, a pure GST engine (`src/lib/gst.ts`).
- Prisma runs as `postgres` (bypasses RLS); tenant isolation is enforced in app code,
  with RLS as defence-in-depth for anon/authenticated key access.

---

Built with [Claude Code](https://claude.com/claude-code).
