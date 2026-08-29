-- When B (referred by A) becomes a partner, A gets credit for B's referrals.
--
-- parent_campaign_id links B's campaign back to A's. The overview view sums
-- indirect referrals from child campaigns, and the reward threshold check
-- includes them. One level only: A←B, not A←B←C.

-- 1. Add parent_campaign_id
alter table public.referral_campaigns
  add column if not exists parent_campaign_id bigint
    references public.referral_campaigns (id) on delete set null;

create index if not exists referral_campaigns_parent_idx
  on public.referral_campaigns (parent_campaign_id)
  where parent_campaign_id is not null;

-- 2. Backfill: for every existing campaign whose partner was referred through
--    another campaign, set parent_campaign_id.
update public.referral_campaigns child
set parent_campaign_id = ref.campaign_id
from public.referrals ref
where child.partner_user_id = ref.referred_user_id
  and child.parent_campaign_id is null
  and ref.campaign_id is not null
  and ref.campaign_id <> child.id;

-- 3. Update create function to set parent_campaign_id automatically
create or replace function public.referral_create_campaign_for_user(p_user_id integer)
returns table (id bigint, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  person       record;
  wanted       text;
  new_id       bigint;
  attempts     integer := 0;
  parent_cid   bigint;
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;

  select u.id, u.email, u.first_name, u.last_name
    into person
    from public.users u
   where u.id = p_user_id and u.is_deleted is not true;
  if not found then raise exception 'no such user'; end if;

  if exists (
    select 1 from public.referral_campaigns c
    where c.partner_user_id = p_user_id and c.active
  ) then
    raise exception 'that user already has an active campaign';
  end if;

  -- If this user was referred through a campaign, that's our parent
  select r.campaign_id into parent_cid
    from public.referrals r
   where r.referred_user_id = p_user_id
   limit 1;

  loop
    wanted := public.referral_random_code();
    exit when not public.referral_code_taken(wanted);
    attempts := attempts + 1;
    if attempts > 20 then raise exception 'could not generate a free code'; end if;
  end loop;

  insert into public.referral_campaigns as c (name, partner_name, partner_user_id, code, parent_campaign_id)
  values (
    coalesce(nullif(trim(coalesce(person.first_name, '') || ' ' || coalesce(person.last_name, '')), ''), person.email),
    coalesce(nullif(trim(coalesce(person.first_name, '') || ' ' || coalesce(person.last_name, '')), ''), person.email),
    p_user_id,
    wanted,
    parent_cid
  )
  returning c.id into new_id;

  perform public.referral_default_rewards(new_id);

  insert into public.referral_codes (user_id, code, campaign_id)
  values (p_user_id, wanted, new_id)
  on conflict (user_id) do update
    set campaign_id = excluded.campaign_id,
        revoked_at  = null;

  return query select new_id, wanted;
end;
$$;

grant execute on function public.referral_create_campaign_for_user(integer) to authenticated;

-- 4. Recreate the overview view with indirect counts
drop view if exists public.referral_campaign_overview;

create view public.referral_campaign_overview
with (security_invoker = on) as
select
  c.id,
  c.partner_name,
  c.partner_user_id,
  p.email as partner_email,
  c.code,
  c.active,
  c.starts_at,
  c.ends_at,
  c.parent_campaign_id,

  -- direct counts
  count(r.id) filter (where r.fraud_status <> 'rejected')::integer                     as joined,
  count(r.id) filter (where r.activated_at is not null and r.fraud_status = 'normal')::integer as activated,
  count(r.id) filter (where r.retained_at  is not null and r.fraud_status = 'normal')::integer as retained,
  count(r.id) filter (where r.fraud_status = 'review')::integer                        as in_review,
  count(r.id) filter (where r.fraud_status = 'rejected')::integer                      as rejected,
  max(r.registered_at)                                                                 as last_join_at,

  -- indirect: referrals from child campaigns (one level)
  coalesce((
    select count(*)::integer
    from public.referrals ir
    join public.referral_campaigns cc on cc.id = ir.campaign_id
    where cc.parent_campaign_id = c.id and ir.fraud_status <> 'rejected'
  ), 0) as indirect_joined,
  coalesce((
    select count(*)::integer
    from public.referrals ir
    join public.referral_campaigns cc on cc.id = ir.campaign_id
    where cc.parent_campaign_id = c.id and ir.activated_at is not null and ir.fraud_status = 'normal'
  ), 0) as indirect_activated,
  coalesce((
    select count(*)::integer
    from public.referrals ir
    join public.referral_campaigns cc on cc.id = ir.campaign_id
    where cc.parent_campaign_id = c.id and ir.retained_at is not null and ir.fraud_status = 'normal'
  ), 0) as indirect_retained

from public.referral_campaigns c
left join public.referrals r on r.campaign_id = c.id
left join public.users p on p.id = c.partner_user_id
group by c.id, c.partner_name, c.partner_user_id, p.email, c.code, c.active, c.starts_at, c.ends_at, c.parent_campaign_id;

grant select on public.referral_campaign_overview to authenticated;

-- 5. Update reward threshold check to include indirect referrals
--    The reward check in refresh_referral_progress counts only direct campaign
--    referrals. We update it to also count child-campaign referrals.
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
      activated_at = case
        when activated_at is not null then activated_at
        when coupons >= 1 and days30 >= 3 and now() < r.registered_at + interval '30 days' + interval '2 days'
          then now()
        when coupons >= 1 and days30 >= 3 then r.registered_at + interval '30 days'
        else null
      end,
      retained_at = case
        when retained_at is not null then retained_at
        when (activated_at is not null or (coupons >= 1 and days30 >= 3)) and days60 >= 2 then now()
        else null
      end,
      fraud_reasons = reasons,
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

  -- Reward threshold: count DIRECT + INDIRECT (one level of child campaigns)
  update public.referral_rewards w set earned_at = now()
  where w.earned_at is null
    and (p_campaign_id is null or w.campaign_id = p_campaign_id)
    and (
      (select count(*) from public.referrals f
       where f.fraud_status = 'normal'
         and (f.campaign_id = w.campaign_id
              or f.campaign_id in (select cc.id from public.referral_campaigns cc where cc.parent_campaign_id = w.campaign_id))
         and case w.metric
               when 'activated' then f.activated_at is not null
               when 'retained'  then f.retained_at  is not null
             end
      ) >= w.threshold
    );

  return touched;
end;
$$;

revoke execute on function public.refresh_referral_progress(bigint) from public;
grant execute on function public.refresh_referral_progress(bigint) to service_role;
