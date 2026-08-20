-- Sync Google and Apple identities into the legacy application user model.
-- OAuth providers never write authorization fields such as is_admin.
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  user_email text := lower(new.email);
  given_name text := coalesce(
    nullif(new.raw_user_meta_data->>'first_name', ''),
    nullif(new.raw_user_meta_data->>'given_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(user_email, '@', 1)
  );
  family_name text := coalesce(
    nullif(new.raw_user_meta_data->>'last_name', ''),
    nullif(new.raw_user_meta_data->>'family_name', ''),
    ''
  );
  provider_name text := coalesce(new.raw_app_meta_data->>'provider', 'email');
  provider_id text := nullif(new.raw_user_meta_data->>'sub', '');
begin
  if user_email is null then
    return new;
  end if;

  insert into public.users (
    email,
    password,
    first_name,
    last_name,
    is_confirmed,
    google_id,
    auth_user_id
  )
  values (
    user_email,
    null,
    given_name,
    family_name,
    true,
    case when provider_name = 'google' then provider_id else null end,
    new.id
  )
  on conflict (email) do update
    set is_confirmed = true,
        auth_user_id = excluded.auth_user_id,
        google_id = case
          when provider_name = 'google'
            then coalesce(public.users.google_id, provider_id)
          else public.users.google_id
        end;

  return new;
end;
$$;

-- Backfill users created before auth_user_id sync existed.
update public.users u
set auth_user_id = au.id
from auth.users au
where lower(u.email) = lower(au.email)
  and u.auth_user_id is null;

revoke execute on function public.handle_auth_user_created() from public, anon, authenticated;
