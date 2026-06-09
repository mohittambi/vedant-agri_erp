# Deploying to Cloudflare Workers (OpenNext)

This app is configured to deploy to **Cloudflare Workers** via
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).

> ✅ The OpenNext build succeeds and produces `.open-next/worker.js`.
>
> ⚠️ **Run the build/deploy from Linux (WSL on Windows) or Cloudflare's Git CI.**
> OpenNext prints `OpenNext is not fully compatible with Windows … could
> encounter unpredictable failures during runtime`. Local `preview` on native
> Windows returns 500s for this reason — it is **not** a problem with the app
> or with Cloudflare itself. Building/deploying from WSL or Linux resolves it.

---

## What was set up

| File | Purpose |
| --- | --- |
| `open-next.config.ts` | OpenNext Cloudflare config |
| `wrangler.jsonc` | Worker name, `nodejs_compat`, assets, Hyperdrive binding, vars |
| `next.config.ts` | `initOpenNextCloudflareForDev()` for bindings in dev |
| `src/lib/prisma.ts` | Reads Hyperdrive `connectionString`, falls back to `DATABASE_URL` |
| `.dev.vars.example` | Template for local Worker secrets |

> **Middleware note:** Next 16's `proxy.ts` only runs on the Node.js runtime,
> which Workers don't support — so it was removed. Authentication is enforced
> authoritatively in Server Components (`requireAuth` / `requirePermission` in
> `src/lib/auth.ts`) and the `(app)` layout, which works on every runtime.

---

## One-time setup

### 1. (Recommended) Create a Hyperdrive for Supabase Postgres

Hyperdrive is Cloudflare's pooled Postgres connection — the reliable way to use
`pg`/Prisma on Workers. Use your Supabase **direct** connection string (port 5432):

```bash
npx wrangler login
npx wrangler hyperdrive create agri-erp-db \
  --connection-string="postgresql://postgres:YOUR-PASSWORD@db.YOUR-REF.supabase.co:5432/postgres"
```

Copy the returned `id` into `wrangler.jsonc` and **uncomment** the `hyperdrive`
block. `src/lib/prisma.ts` already prefers `HYPERDRIVE.connectionString`.

> Prefer not to use Hyperdrive? Skip this and instead set a `DATABASE_URL`
> secret to your Supabase **pooler** URL (port 6543, `?pgbouncer=true`). The app
> falls back to `DATABASE_URL` automatically.

### 2. Set runtime secrets

```bash
npx wrangler secret put DATABASE_URL                # Supabase pooler URL (if not using Hyperdrive)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
```

> `NEXT_PUBLIC_*` values are also **inlined at build time**, so make sure they're
> present in `.env.local` (or the CI env) when you run the build.

### 3. Local Worker testing (use WSL on Windows)

```bash
cp .dev.vars.example .dev.vars   # fill in real values
npm run cf:preview               # builds + runs the worker in workerd
```

---

## Deploy

```bash
npm run cf:deploy                # opennextjs-cloudflare build && deploy
```

This builds the Next app, bundles the worker, and pushes it to your Cloudflare
account. The first deploy provisions the Worker + a `workers.dev` URL.

### Or deploy via Git (recommended on Windows)

1. Push the repo to GitHub.
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Import a repository**.
3. Build command: `npx opennextjs-cloudflare build`
   Deploy command: `npx opennextjs-cloudflare deploy`
4. Add the env vars/secrets from step 2 in the dashboard.
5. Bind the Hyperdrive (from step 1) to the project.

---

## Database migrations

Run these once against Supabase from your machine (they don't run on Workers):

```bash
npm run db:deploy   # or: npx prisma db push
npm run db:sql      # RLS, triggers, storage
npm run db:seed     # roles, permissions, super admin
npm run db:demo     # optional demo data
```

---

## Troubleshooting

- **500 on every route in local `preview` on Windows** → expected; build/preview
  from **WSL** or deploy via **Git CI** (Linux). See the warning at the top.
- **DB connection errors on Workers** → use **Hyperdrive** (step 1). Raw `pg`
  to Supabase from Workers is far less reliable than via Hyperdrive.
- **`nodejs_compat` errors** → ensure `compatibility_flags: ["nodejs_compat"]`
  and a recent `compatibility_date` are set in `wrangler.jsonc` (already done).
- **Next 16 + OpenNext is new** — if a build patch fails, check for an
  `@opennextjs/cloudflare` update.
