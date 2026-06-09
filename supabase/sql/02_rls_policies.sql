-- ===========================================================================
-- 02 — Row Level Security policies
-- Enforces MULTI-FIRM ISOLATION for any access via the anon / authenticated
-- keys (Realtime, Storage, direct PostgREST). Prisma uses the postgres role
-- and bypasses RLS — app-level checks in lib/auth.ts cover that path.
-- Idempotent.
-- ===========================================================================

-- --- Firm-scoped tables: one FOR ALL policy keyed on firm_id -----------------
do $$
declare
  t text;
  firm_tables text[] := array[
    'locations','categories','manufacturers','tax_groups','products',
    'inventory_batches','stock_ledger','customers','suppliers',
    'purchase_invoices','purchase_returns','sales_invoices','sales_returns',
    'customer_ledger','supplier_ledger','vouchers','notifications','settings'
  ];
begin
  foreach t in array firm_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_firm_isolation', t);
    execute format(
      'create policy %I on public.%I
         using (public.user_in_firm(firm_id))
         with check (public.user_in_firm(firm_id));',
      t || '_firm_isolation', t
    );
  end loop;
end $$;

-- --- Child/item tables: isolate via parent firm ------------------------------
alter table public.purchase_invoice_items enable row level security;
drop policy if exists pii_firm on public.purchase_invoice_items;
create policy pii_firm on public.purchase_invoice_items
  using (exists (select 1 from public.purchase_invoices p
                 where p.id = invoice_id and public.user_in_firm(p.firm_id)))
  with check (exists (select 1 from public.purchase_invoices p
                 where p.id = invoice_id and public.user_in_firm(p.firm_id)));

alter table public.purchase_return_items enable row level security;
drop policy if exists pri_firm on public.purchase_return_items;
create policy pri_firm on public.purchase_return_items
  using (exists (select 1 from public.purchase_returns r
                 where r.id = return_id and public.user_in_firm(r.firm_id)))
  with check (exists (select 1 from public.purchase_returns r
                 where r.id = return_id and public.user_in_firm(r.firm_id)));

alter table public.sales_invoice_items enable row level security;
drop policy if exists sii_firm on public.sales_invoice_items;
create policy sii_firm on public.sales_invoice_items
  using (exists (select 1 from public.sales_invoices s
                 where s.id = invoice_id and public.user_in_firm(s.firm_id)))
  with check (exists (select 1 from public.sales_invoices s
                 where s.id = invoice_id and public.user_in_firm(s.firm_id)));

alter table public.sales_return_items enable row level security;
drop policy if exists sri_firm on public.sales_return_items;
create policy sri_firm on public.sales_return_items
  using (exists (select 1 from public.sales_returns r
                 where r.id = return_id and public.user_in_firm(r.firm_id)))
  with check (exists (select 1 from public.sales_returns r
                 where r.id = return_id and public.user_in_firm(r.firm_id)));

-- --- Identity / tenancy tables ------------------------------------------------
alter table public.firms enable row level security;
drop policy if exists firms_access on public.firms;
create policy firms_access on public.firms
  using (public.user_in_firm(id))
  with check (public.is_super_admin());

alter table public.users enable row level security;
drop policy if exists users_self_or_firm on public.users;
create policy users_self_or_firm on public.users
  using (
    id = auth.uid()
    or public.is_super_admin()
    or exists (select 1 from public.user_roles ur
               where ur.user_id = public.users.id and public.user_in_firm(ur.firm_id))
  )
  with check (id = auth.uid() or public.is_super_admin());

alter table public.roles enable row level security;
drop policy if exists roles_access on public.roles;
create policy roles_access on public.roles
  using (firm_id is null or public.user_in_firm(firm_id))
  with check (public.is_super_admin() or (firm_id is not null and public.user_in_firm(firm_id)));

alter table public.permissions enable row level security;
drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions
  for select using (auth.role() = 'authenticated');

alter table public.role_permissions enable row level security;
drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions
  for select using (auth.role() = 'authenticated');

alter table public.user_roles enable row level security;
drop policy if exists user_roles_access on public.user_roles;
create policy user_roles_access on public.user_roles
  using (user_id = auth.uid() or public.user_in_firm(firm_id))
  with check (public.user_in_firm(firm_id));

alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_access on public.audit_logs;
create policy audit_logs_access on public.audit_logs
  for select using (public.is_super_admin() or (firm_id is not null and public.user_in_firm(firm_id)));
