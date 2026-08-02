-- Keep the legacy public.users record in sync with Supabase Auth users.
-- This lets Google OAuth users use the existing application data model.
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_email text := lower(new.email);
  given_name text := coalesce(nullif(new.raw_user_meta_data->>'first_name', ''), nullif(new.raw_user_meta_data->>'full_name', ''), split_part(user_email, '@', 1));
  family_name text := coalesce(nullif(new.raw_user_meta_data->>'last_name', ''), '');
  provider_id text := nullif(new.raw_user_meta_data->>'sub', '');
begin
  if user_email is null then return new; end if;

  update public.users
     set is_confirmed = true,
         google_id = coalesce(google_id, provider_id)
   where lower(email) = user_email;

  if not found then
    insert into public.users (email, password, first_name, last_name, is_confirmed, google_id)
    values (user_email, null, given_name, family_name, true, provider_id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();
