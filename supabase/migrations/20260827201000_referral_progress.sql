-- Deciding who counts.
--
-- The whole point of the referral pilot is that money follows real use, not
-- sign-ups. So the verdict is computed here, from two sources the referred
-- person cannot forge: `coupon`, which they own, and `user_activities`, which
-- only the log-activity function may write.
--
-- Two milestones:
--   activated — a real coupon, plus coupon activity on 3 separate days, all
--               inside the first 30 days.
--   retained  — coupon activity on 2 separate days between day 31 and day 60.
--
-- Both are one-way and both are checked continuously. Retention in particular
-- is not a day-60 batch: someone who qualifies on day 42 is retained on day
-- 42, and the window merely *closes* on day 60. The partner watching a
-- dashboard should see it move.

-- Opening the app is not use of a coupon app, and neither is logging in. These
-- are the actions from the shared vocabulary that mean someone actually did
-- something with a coupon; the list is deliberately narrower than the table.
create or replace function public.referral_qualifying_actions()
returns text[]
language sql
immutable
as $$
  select array[
    'view_coupon',
    'view_coupon_code',
    'open_redemption_url',
    'add_coupon_submit',
    'edit_coupon_submit',
    'scan_coupon',
    'record_coupon_usage',
    'mark_coupon_as_used',
    'share_coupon'
  ]::text[]
$$;

-- How many distinct days this person used a coupon inside a window.
--
-- `user_activities.timestamp` is a naive column holding UTC. Israel is two or
-- three hours ahead of it, so counting days in UTC would file an 01:00 tap
-- under the previous date — and "3 different days" is the entire criterion.
create or replace function public.referral_activity_days(
  p_user_id integer,
  p_from    timestamptz,
  p_to      timestamptz
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(distinct (a.timestamp at time zone 'UTC' at time zone 'Asia/Jerusalem')::date)::integer
  from public.user_activities a
  where a.user_id = p_user_id
    and a.action = any (public.referral_qualifying_actions())
    and a.timestamp >= (p_from at time zone 'UTC')
    and a.timestamp <  (p_to   at time zone 'UTC')
$$;

-- Fraud signals, recomputed on every pass rather than stored once at claim
-- time: the tell-tale patterns (several accounts per install, a burst of
-- sign-ups from one address) only become visible after the *later* accounts
-- exist, which is always after the first one was claimed.
--
-- An address is never grounds on its own. A family, an office and a mobile
-- carrier all share one, so it raises a flag for a human and nothing more.
-- Only a chain that pays its own author is auto-rejected.
create or replace function public.referral_fraud_reasons(p_referral_id bigint)
returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r        public.referrals;
  reasons  text[] := '{}';
  n        integer;
begin
  select * into r from public.referrals where id = p_referral_id;
  if not found then return reasons; end if;

  if r.install_hash is not null then
    select count(*) into n
    from public.referrals x
    where x.install_hash = r.install_hash;
    if n >= 3 then reasons := reasons || 'duplicate_install'; end if;
  end if;

  -- A pays B and B pays A: the chain closes on itself and manufactures two
  -- qualifying users out of two people who already knew each other.
  if r.direct_referrer_user_id is not null and exists (
    select 1 from public.referrals back
    where back.referred_user_id = r.direct_referrer_user_id
      and back.direct_referrer_user_id = r.referred_user_id
  ) then
    reasons := reasons || 'reciprocal_referral';
  end if;

  select count(distinct b.referred_user_id) into n
  from public.referrals a
  join public.user_activities ua_a on ua_a.user_id = a.referred_user_id
  join public.user_activities ua_b on ua_b.ip_address = ua_a.ip_address
  join public.referrals b on b.referred_user_id = ua_b.user_id
  where a.id = p_referral_id
    and ua_a.ip_address is not null
    and b.campaign_id = r.campaign_id
    and abs(extract(epoch from (b.registered_at - r.registered_at))) < 86400;
  if n >= 5 then reasons := reasons || 'ip_burst'; end if;

  return reasons;
end;
$$;

-- The one job. Idempotent, safe to run as often as you like, and the only
-- place `activated_at` and `retained_at` are ever set.
create or replace function public.refresh_referral_progress(p_campaign_id bigint default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r        record;
  touched  integer := 0;
  coupons  integer;
  first_at timestamptz;
  days30   integer;
  days60   integer;
  reasons  text[];
begin
  for r in
    select * from public.referrals
    where (p_campaign_id is null or campaign_id = p_campaign_id)
      -- Once retained there is nothing left to decide, and the 60-day window
      -- has closed on everyone else this skips.
      and (retained_at is null and registered_at > now() - interval '75 days')
  loop
    select count(*), min(c.date_added at time zone 'UTC')
      into coupons, first_at
      from public.coupon c
     where c.user_id = r.referred_user_id;

    days30 := public.referral_activity_days(
      r.referred_user_id, r.registered_at, r.registered_at + interval '30 days');
    days60 := public.referral_activity_days(
      r.referred_user_id, r.registered_at + interval '30 days', r.registered_at + interval '60 days');

    reasons := public.referral_fraud_reasons(r.id);

    update public.referrals set
      coupon_count         = coupons,
      first_coupon_at      = coalesce(first_coupon_at, first_at),
      active_days_first_30 = days30,
      active_days_31_60    = days60,
      progress_checked_at  = now(),

      -- Written once. A person who qualified in March stays qualified in June
      -- even though the 30-day window is long shut.
      activated_at = case
        when activated_at is not null then activated_at
        when coupons >= 1 and days30 >= 3 and now() < r.registered_at + interval '30 days' + interval '2 days'
          then now()
        -- The window may have closed between two runs of this job; the
        -- evidence is still in the table, so judge it rather than lose it.
        when coupons >= 1 and days30 >= 3 then r.registered_at + interval '30 days'
        else null
      end,

      retained_at = case
        when retained_at is not null then retained_at
        when (activated_at is not null or (coupons >= 1 and days30 >= 3)) and days60 >= 2 then now()
        else null
      end,

      fraud_reasons = reasons,
      -- A human verdict is never overwritten by the job: an admin who cleared
      -- a flagged row has seen more than this function can.
      fraud_status = case
        when reviewed_at is not null then fraud_status
        when 'reciprocal_referral' = any (reasons) then 'rejected'
        when array_length(reasons, 1) > 0 then 'review'
        else 'normal'
      end
    where id = r.id;

    touched := touched + 1;
  end loop;

  update public.referrals set status = case
    when retained_at is not null then 'retained'
    when activated_at is not null then 'activated'
    else 'registered'
  end
  where (p_campaign_id is null or campaign_id = p_campaign_id)
    and status is distinct from (case
      when retained_at is not null then 'retained'
      when activated_at is not null then 'activated'
      else 'registered'
    end);

  -- Reaching a threshold is recorded, not paid. Handing over a Dream Card is
  -- a person's decision and stays one; this only stamps when it was earned.
  update public.referral_rewards w set earned_at = now()
  where w.earned_at is null
    and (p_campaign_id is null or w.campaign_id = p_campaign_id)
    and (
      select count(*) from public.referrals f
      where f.campaign_id = w.campaign_id
        and f.fraud_status = 'normal'
        and case w.metric
              when 'activated' then f.activated_at is not null
              when 'retained'  then f.retained_at  is not null
            end
    ) >= w.threshold;

  return touched;
end;
$$;

revoke execute on function public.refresh_referral_progress(bigint) from public;
grant execute on function public.refresh_referral_progress(bigint) to service_role;
