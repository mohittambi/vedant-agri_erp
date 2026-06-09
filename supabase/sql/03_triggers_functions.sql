-- ===========================================================================
-- 03 — Triggers & business-rule functions
-- Idempotent.
-- ===========================================================================

-- --- Auto-maintain updated_at -------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
  tables_with_updated_at text[] := array[
    'firms','users','roles','locations','categories','manufacturers',
    'tax_groups','products','inventory_batches','customers','suppliers',
    'purchase_invoices','purchase_returns','sales_invoices','sales_returns',
    'vouchers','settings'
  ];
begin
  foreach t in array tables_with_updated_at loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- --- Business rule: Cash Rate < Credit Rate ----------------------------------
create or replace function public.enforce_product_rate_rule()
returns trigger language plpgsql as $$
begin
  if new.cash_rate > 0 and new.credit_rate > 0 and new.cash_rate >= new.credit_rate then
    raise exception 'Cash rate (%) must be strictly less than credit rate (%)',
      new.cash_rate, new.credit_rate
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_rate_rule on public.products;
create trigger enforce_rate_rule
  before insert or update on public.products
  for each row execute function public.enforce_product_rate_rule();

-- --- Non-expired available stock (real-time inventory check) ------------------
-- Total sellable quantity for a product at a location, excluding expired and
-- zero-quantity batches.
create or replace function public.available_stock(
  p_firm uuid, p_product uuid, p_location uuid
) returns numeric
language sql stable as $$
  select coalesce(sum(b.quantity), 0)
  from public.inventory_batches b
  where b.firm_id = p_firm
    and b.product_id = p_product
    and b.location_id = p_location
    and b.quantity > 0
    and (b.expiry_date is null or b.expiry_date >= current_date);
$$;

-- --- FIFO allocation plan -----------------------------------------------------
-- Returns the batches (oldest received first) to consume to satisfy p_qty.
-- EXPIRED batches are skipped entirely (expired stock cannot be sold).
-- The final row may be a partial allocation. If total sellable < p_qty the
-- returned allocations will sum to less than p_qty (caller must validate).
create or replace function public.fifo_allocate(
  p_firm uuid, p_product uuid, p_location uuid, p_qty numeric
)
returns table(batch_id uuid, batch_number text, expiry_date date, allocate_qty numeric)
language plpgsql stable as $$
declare
  remaining numeric := p_qty;
  rec record;
begin
  for rec in
    select b.id, b.batch_number, b.expiry_date, b.quantity
    from public.inventory_batches b
    where b.firm_id = p_firm
      and b.product_id = p_product
      and b.location_id = p_location
      and b.quantity > 0
      and (b.expiry_date is null or b.expiry_date >= current_date)
    order by b.received_at asc, b.created_at asc
  loop
    exit when remaining <= 0;
    batch_id := rec.id;
    batch_number := rec.batch_number;
    expiry_date := rec.expiry_date;
    allocate_qty := least(remaining, rec.quantity);
    remaining := remaining - allocate_qty;
    return next;
  end loop;
end;
$$;

-- --- Guard: prevent inventory_batches quantity going negative -----------------
create or replace function public.enforce_non_negative_batch()
returns trigger language plpgsql as $$
begin
  if new.quantity < 0 then
    raise exception 'Batch % would go negative (%). Insufficient stock.',
      new.batch_number, new.quantity
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists non_negative_batch on public.inventory_batches;
create trigger non_negative_batch
  before update on public.inventory_batches
  for each row execute function public.enforce_non_negative_batch();

grant execute on function public.available_stock(uuid, uuid, uuid) to authenticated;
grant execute on function public.fifo_allocate(uuid, uuid, uuid, numeric) to authenticated;
