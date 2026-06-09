-- ===========================================================================
-- 04 — Storage buckets & policies
-- Idempotent. Run after the project's storage schema exists (always does on
-- Supabase). Public buckets serve assets directly; private buckets require a
-- signed URL or an authenticated session.
-- ===========================================================================

insert into storage.buckets (id, name, public)
values
  ('firm-logos',     'firm-logos',     true),
  ('product-images', 'product-images', true),
  ('invoice-pdfs',   'invoice-pdfs',   false),
  ('user-profiles',  'user-profiles',  true),
  ('documents',      'documents',      false)
on conflict (id) do update set public = excluded.public;

-- --- Public buckets: world-readable, authenticated write ----------------------
do $$
declare b text;
  public_buckets text[] := array['firm-logos','product-images','user-profiles'];
begin
  foreach b in array public_buckets loop
    execute format('drop policy if exists %I on storage.objects;', b || '_read');
    execute format(
      'create policy %I on storage.objects for select
         using (bucket_id = %L);', b || '_read', b);

    execute format('drop policy if exists %I on storage.objects;', b || '_write');
    execute format(
      'create policy %I on storage.objects for insert to authenticated
         with check (bucket_id = %L);', b || '_write', b);

    execute format('drop policy if exists %I on storage.objects;', b || '_update');
    execute format(
      'create policy %I on storage.objects for update to authenticated
         using (bucket_id = %L);', b || '_update', b);

    execute format('drop policy if exists %I on storage.objects;', b || '_delete');
    execute format(
      'create policy %I on storage.objects for delete to authenticated
         using (bucket_id = %L);', b || '_delete', b);
  end loop;
end $$;

-- --- Private buckets: authenticated read + write only -------------------------
do $$
declare b text;
  private_buckets text[] := array['invoice-pdfs','documents'];
begin
  foreach b in array private_buckets loop
    execute format('drop policy if exists %I on storage.objects;', b || '_rw');
    execute format(
      'create policy %I on storage.objects for all to authenticated
         using (bucket_id = %L) with check (bucket_id = %L);',
      b || '_rw', b, b);
  end loop;
end $$;
