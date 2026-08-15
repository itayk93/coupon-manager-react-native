-- 0010: Real-auth foundation.
--
-- Today every client talks to PostgREST with the anon key and RLS is satisfied
-- by blanket `using (true)` policies granted to `anon`. auth.users is empty, so
-- auth.uid() is always null and the per-user policies that already exist can
-- never match. This migration adds the pieces the real policies need, without
-- changing any existing policy, so it is safe to apply while the app is live.
--
-- Follow-up: 0011 rewrites the policies and drops the anon ones.

-- 1. Link public.users (integer id, legacy Flask schema) to auth.users (uuid).
alter table public.users
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

create index if not exists users_auth_user_id_idx on public.users (auth_user_id);

-- 2. Resolve the calling JWT to a legacy user id.
--    security definer so the lookup itself is not subject to RLS on users.
create or replace function public.app_user_id()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.is_deleted is not true
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select u.is_admin
     from public.users u
     where u.auth_user_id = auth.uid()
       and u.is_deleted is not true),
    false)
$$;

revoke execute on function public.app_user_id() from public;
revoke execute on function public.is_app_admin() from public;
grant execute on function public.app_user_id() to authenticated, service_role;
grant execute on function public.is_app_admin() to authenticated, service_role;

-- 3. Block privilege escalation through the users table.
--    Even with a correct "update your own row" policy, a client could otherwise
--    send {"is_admin": true}. RLS cannot express column-level rules, so a
--    trigger forces the protected columns back to their previous values for
--    anyone who is not an admin acting through service_role.
create or replace function public.guard_users_self_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('role', true) = 'service_role'
     or auth.role() = 'service_role' then
    return new;
  end if;

  new.id           := old.id;
  new.email        := old.email;
  new.password     := old.password;
  new.is_admin     := old.is_admin;
  new.is_deleted   := old.is_deleted;
  new.is_confirmed := old.is_confirmed;
  new.auth_user_id := old.auth_user_id;
  new.google_id    := old.google_id;
  new.slots        := old.slots;
  new.slots_automatic_coupons := old.slots_automatic_coupons;

  return new;
end;
$$;

drop trigger if exists guard_users_self_update on public.users;
create trigger guard_users_self_update
  before update on public.users
  for each row
  execute function public.guard_users_self_update();

-- Note: revoking select(password) is deliberately NOT done here. The current
-- web and iOS clients still verify passwords in the browser by reading the
-- hash, so revoking it now would break login. 0011 revokes it, after
-- legacy-login moves that check to the server.
