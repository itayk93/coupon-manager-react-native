-- Account-privacy plumbing: consent trail, erasure, activity retention,
-- security-incident register. Pairs with the coupon-vault actions
-- record_consent / export_account / delete_account.

-- ---------------------------------------------------------------------------
-- 1. Consent trail on the user row (the audit rows live in user_consents).
-- ---------------------------------------------------------------------------
alter table public.users
  add column if not exists privacy_consent_version text,
  add column if not exists privacy_consent_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Complete erasure. The old path only cleared coupon/notifications/
--    user_activities and left spending history, shares, consents, push tokens,
--    referral rows and gpt_usage behind. This clears everything tied to the
--    account, in FK order, then removes the auth identity.
-- ---------------------------------------------------------------------------
create or replace function public.delete_account_data(p_user_id int)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_auth_id uuid;
begin
  select auth_user_id into v_auth_id from public.users where id = p_user_id;

  -- Coupon children with NO ACTION / RESTRICT FKs — must go before the coupons.
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

  -- coupon_transaction / coupon_usage_imports / coupon_alerts cascade from here.
  delete from public.coupon where user_id = p_user_id;

  -- User-scoped rows whose FK does not cascade from users.
  delete from public.gpt_usage           where user_id = p_user_id;
  delete from public.newsletter_sendings where user_id = p_user_id;
  delete from public.notifications       where user_id = p_user_id;
  delete from public.opt_outs            where user_id = p_user_id;
  delete from public.auto_update_runs
    where user_id = p_user_id or triggered_by_user_id = p_user_id;
  delete from public.referral_applications where user_id = p_user_id;

  -- user_activities, user_consents, user_feature_overrides, notification_events,
  -- notification_preferences, referral_codes and referrals(referred) all have
  -- ON DELETE CASCADE from users and go with the row below. referral_campaigns /
  -- referral_rewards keep their rows with partner_user_id set to NULL.
  delete from public.users where id = p_user_id;

  -- The auth identity last, and defensively: a failure here (already gone,
  -- permissions) must not roll back the data deletion above.
  if v_auth_id is not null then
    begin
      delete from auth.users where id = v_auth_id;
    exception when others then
      raise warning 'delete_account_data: auth.users % not removed: %', v_auth_id, sqlerrm;
    end;
  end if;
end;
$$;
revoke all on function public.delete_account_data(int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Activity-log retention. IP is already stripped at 90 days
--    (strip_old_activity_ip). The rows themselves — which screens, which coupon
--    actions — have no reason to live forever. 400 days covers a year of
--    year-over-year analytics and fraud look-back.
-- ---------------------------------------------------------------------------
create or replace function public.purge_stale_activity()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.user_activities
  where "timestamp" < now() - interval '400 days';
$$;
revoke all on function public.purge_stale_activity() from public, anon, authenticated;

select cron.unschedule('activity-log-purge')
  where exists (select 1 from cron.job where jobname = 'activity-log-purge');
select cron.schedule('activity-log-purge', '30 3 * * *',
  $$select public.purge_stale_activity();$$);

-- ---------------------------------------------------------------------------
-- 4. Security-incident register. Amendment 13 to the Israeli Privacy
--    Protection Law requires a record of security incidents and, for a severe
--    one, notification to the Privacy Protection Authority. This is the record
--    store; RLS denies everyone (service role / admin tooling only).
-- ---------------------------------------------------------------------------
create table if not exists public.security_incidents (
  id                     bigint generated always as identity primary key,
  detected_at            timestamptz not null default now(),
  severity               text not null check (severity in ('low','medium','high','severe')),
  summary                text not null,
  affected_user_count    int,
  personal_data_involved text,
  containment            text,
  reported_to_authority_at timestamptz,
  reported_to_users_at   timestamptz,
  notes                  text,
  created_at             timestamptz not null default now()
);
alter table public.security_incidents enable row level security;
