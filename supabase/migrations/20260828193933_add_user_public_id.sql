-- Public user identity. Keep users.id as the internal integer primary key: it
-- is referenced by the legacy schema, RLS helpers, jobs, and dozens of FKs.
alter table public.users
  add column public_id text
  default ('usr_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));

update public.users
set public_id = 'usr_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)
where public_id is null;

alter table public.users
  alter column public_id set not null;

alter table public.users
  add constraint users_public_id_format
  check (public_id ~ '^usr_[0-9a-f]{20}$');

create unique index users_public_id_key
  on public.users (public_id);

comment on column public.users.public_id is
  'Opaque stable identifier for public/API boundaries. Never use auth_user_id externally.';

-- public.users uses column-level SELECT grants so newly-added columns are not
-- readable automatically. RLS still decides which rows are visible.
grant select (public_id) on public.users to authenticated;

-- public_id is generated once and is never client-editable. A dedicated guard
-- avoids coupling this migration to the older, larger self-update guard.
create or replace function public.guard_users_public_id()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.public_id := old.public_id;
  return new;
end;
$$;

drop trigger if exists guard_users_public_id on public.users;
create trigger guard_users_public_id
  before update on public.users
  for each row
  execute function public.guard_users_public_id();

revoke execute on function public.guard_users_public_id() from public, anon, authenticated;
