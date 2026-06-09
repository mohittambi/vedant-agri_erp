-- ===========================================================================
-- 01 — Auth sync + RLS helper functions
-- Apply AFTER `prisma migrate deploy` (tables must already exist).
-- Idempotent: safe to re-run.
-- ===========================================================================

-- --- Keep public.users in sync with auth.users --------------------------------
-- When a new auth user is created (via Supabase Auth), mirror a row into
-- public.users. The full_name is taken from user metadata when present.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, is_super_admin, is_active, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'is_super_admin')::boolean, false),
    true,
    now(),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep email changes in sync.
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
     set email = new.email, updated_at = now()
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute function public.handle_auth_user_updated();

-- --- RLS helper functions -----------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.is_super_admin from public.users u where u.id = auth.uid()),
    false
  );
$$;

-- True when the current auth user belongs to the given firm (or is super admin).
create or replace function public.user_in_firm(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid() and ur.firm_id = fid
      );
$$;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.user_in_firm(uuid) to authenticated;
