-- Who may see and change any of this.
--
-- The referral tables say how much money a partner is owed, and they hold the
-- fact that person A brought person B. So: no client writes at all, admin-only
-- reads, and every admin action goes through a function that can be told
-- exactly which columns it may touch. `is_app_admin()` resolves the flag from
-- the JWT inside the database, which is what makes this a permission rather
-- than a hidden tab.

alter table public.referral_campaigns enable row level security;
alter table public.referral_codes     enable row level security;
alter table public.referrals          enable row level security;
alter table public.referral_rewards   enable row level security;

revoke all on public.referral_campaigns from anon, authenticated;
revoke all on public.referral_codes     from anon, authenticated;
revoke all on public.referrals          from anon, authenticated;
revoke all on public.referral_rewards   from anon, authenticated;

grant select on public.referral_campaigns to authenticated;
grant select on public.referral_codes     to authenticated;
grant select on public.referrals          to authenticated;
grant select on public.referral_rewards   to authenticated;

drop policy if exists referral_campaigns_admin_read on public.referral_campaigns;
create policy referral_campaigns_admin_read on public.referral_campaigns
  for select to authenticated using (public.is_app_admin());

drop policy if exists referral_rewards_admin_read on public.referral_rewards;
create policy referral_rewards_admin_read on public.referral_rewards
  for select to authenticated using (public.is_app_admin());

drop policy if exists referrals_admin_read on public.referrals;
create policy referrals_admin_read on public.referrals
  for select to authenticated using (public.is_app_admin());

-- The one row a normal person may read is their own code, because the app has
-- to render it on the invite screen. Not the chain, not who they brought.
drop policy if exists referral_codes_own_read on public.referral_codes;
create policy referral_codes_own_read on public.referral_codes
  for select to authenticated
  using (user_id = public.app_user_id() or public.is_app_admin());

-- ------------------------------------------------------------ claiming

-- Codes are read aloud and retyped, so the alphabet drops every pair that
-- looks alike in a sans-serif font: 0/O, 1/I/L, 5/S, 8/B.
create or replace function public.referral_random_code()
returns text
language sql
volatile
as $$
  select string_agg(substr('ACDEFGHJKMNPQRTUVWXY2346799', (random() * 26)::integer + 1, 1), '')
  from generate_series(1, 6)
$$;

-- Resolve a typed code to the campaign it belongs to and the person who owns
-- it. A campaign code is depth 1 — straight from the partner. A personal code
-- inherits its owner's campaign and sits one level deeper, which is how the
-- chain keeps rolling up to whoever started it.
create or replace function public.referral_resolve_code(p_code text)
returns table (campaign_id bigint, referrer_user_id integer, depth integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.partner_user_id, 1
  from public.referral_campaigns c
  where lower(c.code) = lower(p_code)
    and c.active
    and c.starts_at <= now()
    and (c.ends_at is null or c.ends_at > now())
  union all
  select k.campaign_id, k.user_id, coalesce(r.depth, 0) + 1
  from public.referral_codes k
  join public.referral_campaigns c on c.id = k.campaign_id
  left join public.referrals r on r.referred_user_id = k.user_id
  where lower(k.code) = lower(p_code)
    and k.revoked_at is null
    and c.active
    and c.starts_at <= now()
    and (c.ends_at is null or c.ends_at > now())
  limit 1
$$;

/**
 * Attribute one newly registered person to one chain.
 *
 * Called by the claim-referral function, which is the only caller that knows
 * the install hash and has verified who is asking. Every rejection returns a
 * word rather than raising: the app must not fail a registration because a
 * referral code was stale, and the caller must not be able to tell from the
 * response whether someone else already used the link.
 */
create or replace function public.claim_referral(
  p_user_id      integer,
  p_code         text,
  p_install_hash text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resolved   record;
  registered timestamptz;
begin
  select created_at at time zone 'UTC' into registered
  from public.users where id = p_user_id and is_deleted is not true;
  if not found then return 'unknown_user'; end if;

  -- Attribution belongs to registration. Without a bound, a code pasted into
  -- a two-year-old account would hand a partner a user they never brought.
  if registered < now() - interval '14 days' then return 'too_late'; end if;

  if exists (select 1 from public.referrals where referred_user_id = p_user_id) then
    return 'already_attributed';
  end if;

  select * into resolved from public.referral_resolve_code(p_code);
  if not found then return 'invalid_code'; end if;
  if resolved.referrer_user_id = p_user_id then return 'self_referral'; end if;
  if resolved.depth > 20 then return 'chain_too_deep'; end if;

  insert into public.referrals (
    referred_user_id, direct_referrer_user_id, campaign_id,
    depth, referral_code, install_hash, registered_at
  ) values (
    p_user_id, resolved.referrer_user_id, resolved.campaign_id,
    resolved.depth, upper(p_code), p_install_hash, registered
  )
  -- Two devices racing the same first launch is a duplicate, not an error.
  on conflict (referred_user_id) do nothing;

  -- Now that they are in a chain they can extend it.
  insert into public.referral_codes (user_id, code, campaign_id)
  values (p_user_id, public.referral_random_code(), resolved.campaign_id)
  on conflict (user_id) do nothing;

  return 'claimed';
end;
$$;

revoke execute on function public.claim_referral(integer, text, text) from public;
grant execute on function public.claim_referral(integer, text, text) to service_role;

-- ------------------------------------------------------- what a user sees

/**
 * The invite screen, in one call: your code and how your chain is doing.
 *
 * Returns nothing for someone outside a campaign, which is what keeps the
 * pilot closed — the screen has nothing to render and hides itself.
 */
create or replace function public.my_referral_status()
returns table (code text, joined integer, activated integer, retained integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select k.code,
    (select count(*)::integer from public.referrals r
      where r.direct_referrer_user_id = k.user_id and r.fraud_status <> 'rejected'),
    (select count(*)::integer from public.referrals r
      where r.direct_referrer_user_id = k.user_id and r.activated_at is not null and r.fraud_status = 'normal'),
    (select count(*)::integer from public.referrals r
      where r.direct_referrer_user_id = k.user_id and r.retained_at is not null and r.fraud_status = 'normal')
  from public.referral_codes k
  where k.user_id = public.app_user_id() and k.revoked_at is null
$$;

grant execute on function public.my_referral_status() to authenticated;

-- ------------------------------------------------------------ admin API

-- One row per referred person, with the evidence already counted so the admin
-- screen is a plain select. security_invoker keeps the RLS above in force:
-- the view is a shape, not a way around the policy.
create or replace view public.referral_admin_rows
with (security_invoker = on) as
select
  r.id,
  r.campaign_id,
  r.depth,
  r.status,
  r.fraud_status,
  r.fraud_reasons,
  r.review_note,
  r.registered_at,
  r.first_coupon_at,
  r.activated_at,
  r.retained_at,
  r.coupon_count,
  r.active_days_first_30,
  r.active_days_31_60,
  r.referral_code,
  u.id    as referred_user_id,
  u.email as referred_email,
  trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) as referred_name,
  p.id    as referrer_user_id,
  trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) as referrer_name
from public.referrals r
join public.users u on u.id = r.referred_user_id
left join public.users p on p.id = r.direct_referrer_user_id;

grant select on public.referral_admin_rows to authenticated;

/**
 * An admin's verdict on one referral.
 *
 * Split out from a plain UPDATE so the grant covers these three columns and
 * nothing else: no grant on the table means no path to `campaign_id`, however
 * the request is shaped. Stamping `reviewed_at` also tells the nightly job to
 * stop overwriting what a person decided.
 */
create or replace function public.referral_set_fraud_status(
  p_referral_id bigint,
  p_status      text,
  p_note        text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('normal', 'review', 'rejected') then
    raise exception 'invalid fraud status';
  end if;

  update public.referrals set
    fraud_status = p_status,
    review_note  = p_note,
    reviewed_by  = public.app_user_id(),
    reviewed_at  = now()
  where id = p_referral_id;
end;
$$;

grant execute on function public.referral_set_fraud_status(bigint, text, text) to authenticated;

/** Records that a reward changed hands. Moving the money stays a human act. */
create or replace function public.referral_mark_reward_paid(
  p_reward_id bigint,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;

  update public.referral_rewards set
    paid_at  = coalesce(paid_at, now()),
    paid_by  = public.app_user_id(),
    paid_note = p_note
  where id = p_reward_id and earned_at is not null;
end;
$$;

grant execute on function public.referral_mark_reward_paid(bigint, text) to authenticated;

/** The refresh button on the admin screen. Same job the cron runs. */
create or replace function public.referral_refresh_now(p_campaign_id bigint default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;
  return public.refresh_referral_progress(p_campaign_id);
end;
$$;

grant execute on function public.referral_refresh_now(bigint) to authenticated;
