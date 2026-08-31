-- Privacy hardening:
--   * opt-in marketing for new accounts
--   * deterministic account erasure, including tables without cascading FKs
--   * no retained AI response bodies and a short usage-metadata retention

-- ---------------------------------------------------------------------------
-- 1. Marketing is optional. Only an explicit signup choice turns it on.
-- ---------------------------------------------------------------------------
alter table public.users
  alter column newsletter_subscription set default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_source text,
  add column if not exists marketing_consent_version text;

-- The old default was true. Keep only subscriptions with an affirmative row
-- showing that the person switched marketing back on.
update public.users u
set newsletter_subscription = false,
    marketing_consent_at = null,
    marketing_consent_source = null,
    marketing_consent_version = null
where u.newsletter_subscription = true
  and not exists (
    select 1 from public.opt_outs o
    where o.user_id = u.id and o.opted_out = false
  );

update public.users u
set marketing_consent_at = coalesce(u.marketing_consent_at, o."timestamp", now()),
    marketing_consent_source = coalesce(u.marketing_consent_source, 'legacy-preference-center'),
    marketing_consent_version = coalesce(u.marketing_consent_version, 'marketing-v1')
from public.opt_outs o
where o.user_id = u.id
  and o.opted_out = false
  and u.newsletter_subscription = true;

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
  newsletter_opt_in boolean := lower(coalesce(
    new.raw_user_meta_data->>'newsletter_subscription',
    'false'
  )) = 'true';
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
    auth_user_id,
    newsletter_subscription,
    marketing_consent_at,
    marketing_consent_source,
    marketing_consent_version
  )
  values (
    user_email,
    null,
    given_name,
    family_name,
    true,
    case when provider_name = 'google' then provider_id else null end,
    new.id,
    newsletter_opt_in,
    case when newsletter_opt_in then now() else null end,
    case when newsletter_opt_in then 'registration' else null end,
    case when newsletter_opt_in then 'marketing-v1' else null end
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
revoke execute on function public.handle_auth_user_created() from public, anon, authenticated;

-- Prepare owner-only signed URLs before the client cutover. The bucket remains
-- public in this stage so installed clients that still use legacy public URLs
-- keep working. A later migration makes it private after the OTA is published.

drop policy if exists "Users read profile images from their own folder" on storage.objects;
create policy "Users read profile images from their own folder"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users delete profile images from their own folder" on storage.objects;
create policy "Users delete profile images from their own folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Published system content should survive an administrator deleting their
-- personal account, but it must no longer point to that person.
alter table public.newsletters alter column created_by drop not null;
alter table public.newsletters drop constraint if exists newsletters_created_by_fkey;
alter table public.newsletters
  add constraint newsletters_created_by_fkey
  foreign key (created_by) references public.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. Erasure covers independent rows too. Auth deletion is transactional:
--    failure rolls the operation back instead of returning a false success.
--    Profile images are removed through the Storage API by coupon-vault before
--    this function is called.
-- ---------------------------------------------------------------------------
create or replace function public.delete_account_data(p_user_id int)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_auth_id uuid;
  v_ip_addresses text[] := array[]::text[];
begin
  select auth_user_id into v_auth_id
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;

  select coalesce(array_agg(distinct source.ip_address), array[]::text[])
  into v_ip_addresses
  from (
    select ip_address from public.user_activities where user_id = p_user_id
    union
    select ip_address from public.user_consents where user_id = p_user_id
  ) source
  where source.ip_address is not null;

  delete from public.coupon_active_viewers
    where user_id = p_user_id
       or coupon_id in (select id from public.coupon where user_id = p_user_id);
  delete from public.coupon_shares
    where shared_by_user_id = p_user_id
       or shared_with_user_id = p_user_id
       or coupon_id in (select id from public.coupon where user_id = p_user_id);
  delete from public.coupon_tags
    where coupon_id in (select id from public.coupon where user_id = p_user_id);
  delete from public.coupon_usage
    where coupon_id in (select id from public.coupon where user_id = p_user_id);
  delete from public.coupon where user_id = p_user_id;

  delete from public.push_subscriptions  where user_id = p_user_id;
  delete from public.user_tour_progress  where user_id = p_user_id;
  delete from public.gpt_usage           where user_id = p_user_id;
  delete from public.notifications       where user_id = p_user_id;
  delete from public.opt_outs            where user_id = p_user_id;
  delete from public.auto_update_runs
    where user_id = p_user_id or triggered_by_user_id = p_user_id;
  delete from public.referral_applications where user_id = p_user_id;

  delete from public.newsletter_sendings where user_id = p_user_id;

  -- Cascades remove activities, consents, preferences, notification events,
  -- coupon alerts, usage-import rows, referral codes and own attribution.
  -- SET NULL preserves newsletters and other people's referral/admin records
  -- without keeping an account link to the deleted person.
  delete from public.users where id = p_user_id;

  delete from public.ip_geo g
  where g.ip_address = any(v_ip_addresses)
    and not exists (
      select 1 from public.user_activities ua where ua.ip_address = g.ip_address
    );

  if v_auth_id is not null then
    delete from auth.users where id = v_auth_id;
  end if;
end;
$$;
revoke all on function public.delete_account_data(int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. AI logs are accounting metadata, not a second copy of coupon content.
-- ---------------------------------------------------------------------------
update public.gpt_usage set response_text = null where response_text is not null;

create or replace function public.purge_stale_gpt_usage()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.gpt_usage
  where created is null or created < now() - interval '90 days';
$$;
revoke all on function public.purge_stale_gpt_usage() from public, anon, authenticated;

select cron.unschedule('gpt-usage-purge')
  where exists (select 1 from cron.job where jobname = 'gpt-usage-purge');
select cron.schedule('gpt-usage-purge', '45 3 * * *',
  $$select public.purge_stale_gpt_usage();$$);

-- Null timestamps must not become a loophole that keeps activity or IP data
-- forever. Valid new rows receive a timestamp; malformed historical rows are
-- minimized immediately.
create or replace function public.strip_old_activity_ip()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.user_activities
    set ip_address = null, extra_metadata = null
  where ("timestamp" is null or "timestamp" < now() - interval '90 days')
    and (ip_address is not null or extra_metadata is not null);

  update public.user_consents
    set ip_address = null
  where ("timestamp" is null or "timestamp" < now() - interval '90 days')
    and ip_address is not null;

  delete from public.ip_geo g
  where g.resolved_at < now() - interval '90 days'
    and not exists (
      select 1 from public.user_activities ua where ua.ip_address = g.ip_address
    );
end;
$$;
revoke all on function public.strip_old_activity_ip() from public, anon, authenticated;

create or replace function public.purge_stale_activity()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.user_activities
  where "timestamp" is null or "timestamp" < now() - interval '400 days';
$$;
revoke all on function public.purge_stale_activity() from public, anon, authenticated;
