-- Partners are made from the admin screen, not from a migration.
--
-- The pilot shipped with one campaign seeded in SQL, which quietly said that
-- running a second deal means writing another migration. It does not. The
-- whole point of a campaign row is that there can be ten of them, each with
-- its own link, its own ladder and its own tally, so the making of one belongs
-- in the app.
--
-- Everything here is admin-only and goes through a function rather than a
-- grant on the table: `referral_campaigns` holds `code`, and a client that can
-- write that column can point an existing partner's link at itself.

-- The ladder a new partner starts on — the terms the first pilot ran on.
-- Not a constraint: rewards are editable per campaign right after, because the
-- second partner rarely agrees to exactly what the first one did.
create or replace function public.referral_default_rewards(p_campaign_id bigint)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  insert into public.referral_rewards (campaign_id, label, metric, threshold, reward_type, reward_value)
  values
    (p_campaign_id, '10 משתמשים מופעלים', 'activated', 10, 'dream_card', 50.00),
    (p_campaign_id, '25 משתמשים מופעלים', 'activated', 25, 'dream_card', 50.00),
    (p_campaign_id, '25 משתמשים שנשארו',  'retained',  25, 'cash',      100.00)
  on conflict (campaign_id, metric, threshold) do nothing
$$;

/**
 * Start a partner, and hand back the code their link is built from.
 *
 * The code is the deal's identity — it goes in a WhatsApp message and gets
 * retyped — so a caller may choose a memorable one, and gets a generated one
 * otherwise. Either way it is validated the same as a code arriving from a
 * link, because the two have to be the same alphabet or the link will not
 * resolve.
 */
/**
 * Is this code spoken for, by a campaign or by a person?
 *
 * Its own function because the answer has to consider both tables — a partner
 * link and a personal link resolve through the same path, so a code that is
 * unique within one table and not the other still sends two chains to one
 * place. Kept out of the caller because `code` there is also the name of a
 * returned column, and a bare reference to it is ambiguous in a way Postgres
 * only complains about at call time.
 */
create or replace function public.referral_code_taken(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.referral_campaigns c where lower(c.code) = lower(p_code))
      or exists (select 1 from public.referral_codes k where lower(k.code) = lower(p_code))
$$;

create or replace function public.referral_create_campaign(
  p_partner_name text,
  p_code         text default null,
  p_notes        text default null
)
returns table (id bigint, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  wanted    text;
  new_id    bigint;
  attempts  integer := 0;
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;
  if coalesce(trim(p_partner_name), '') = '' then
    raise exception 'partner name is required';
  end if;

  wanted := upper(trim(coalesce(p_code, '')));
  if wanted <> '' then
    -- Same rule as normalizeReferralCode on the device. A code with a space or
    -- a dash in it survives being saved here and then fails to resolve when a
    -- real person taps the link, which is the worst possible time to find out.
    if wanted !~ '^[A-Z0-9]{3,24}$' then
      raise exception 'a code must be 3-24 letters and digits';
    end if;
    if public.referral_code_taken(wanted) then
      raise exception 'that code is already taken';
    end if;
  else
    -- Generated codes collide about never, but "about never" over a long
    -- enough run is a partner whose link belongs to someone else.
    loop
      wanted := public.referral_random_code();
      exit when not public.referral_code_taken(wanted);
      attempts := attempts + 1;
      if attempts > 20 then raise exception 'could not generate a free code'; end if;
    end loop;
  end if;

  insert into public.referral_campaigns as c (name, partner_name, code, notes)
  values (trim(p_partner_name), trim(p_partner_name), wanted, nullif(trim(coalesce(p_notes, '')), ''))
  returning c.id into new_id;

  perform public.referral_default_rewards(new_id);

  return query select new_id, wanted;
end;
$$;

grant execute on function public.referral_create_campaign(text, text, text) to authenticated;

/**
 * Close a partner's link without losing what it brought.
 *
 * Deactivating is the only way to end a deal: deleting the campaign would take
 * its referrals with it, and "how many did that one actually bring" is asked
 * long after the arrangement ends. An inactive code stops resolving, so no new
 * person is attributed, while everyone already in the chain keeps counting.
 */
create or replace function public.referral_set_campaign_active(
  p_campaign_id bigint,
  p_active      boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;
  update public.referral_campaigns
     set active = p_active,
         ends_at = case when p_active then null else now() end
   where id = p_campaign_id;
end;
$$;

grant execute on function public.referral_set_campaign_active(bigint, boolean) to authenticated;

/** A rung on one partner's ladder. Ten partners, ten different deals. */
create or replace function public.referral_upsert_reward(
  p_campaign_id  bigint,
  p_metric       text,
  p_threshold    integer,
  p_reward_type  text,
  p_reward_value numeric,
  p_label        text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;
  if p_metric not in ('activated', 'retained') then raise exception 'invalid metric'; end if;
  if p_reward_type not in ('dream_card', 'cash') then raise exception 'invalid reward type'; end if;
  if p_threshold is null or p_threshold < 1 then raise exception 'threshold must be at least 1'; end if;

  insert into public.referral_rewards (campaign_id, label, metric, threshold, reward_type, reward_value)
  values (
    p_campaign_id,
    coalesce(nullif(trim(coalesce(p_label, '')), ''),
             p_threshold || (case p_metric when 'activated' then ' משתמשים מופעלים' else ' משתמשים שנשארו' end)),
    p_metric, p_threshold, p_reward_type, p_reward_value
  )
  on conflict (campaign_id, metric, threshold) do update
    -- Only the terms. earned_at and paid_at are history, and editing the value
    -- of a rung that has already been handed over would rewrite what happened.
    set reward_type  = excluded.reward_type,
        reward_value = excluded.reward_value,
        label        = excluded.label
    where public.referral_rewards.paid_at is null;
end;
$$;

grant execute on function public.referral_upsert_reward(bigint, text, integer, text, numeric, text) to authenticated;

/** Remove a rung nobody has reached. One already earned is a record. */
create or replace function public.referral_delete_reward(p_reward_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;
  delete from public.referral_rewards where id = p_reward_id and earned_at is null;
end;
$$;

grant execute on function public.referral_delete_reward(bigint) to authenticated;

-- Every partner on one line, so the question "how is each of them doing" does
-- not mean clicking through ten campaigns. security_invoker keeps the admin
-- policy on `referrals` in force.
create or replace view public.referral_campaign_overview
with (security_invoker = on) as
select
  c.id,
  c.partner_name,
  c.code,
  c.active,
  c.starts_at,
  c.ends_at,
  c.notes,
  count(r.id) filter (where r.fraud_status <> 'rejected')::integer                     as joined,
  count(r.id) filter (where r.activated_at is not null and r.fraud_status = 'normal')::integer as activated,
  count(r.id) filter (where r.retained_at  is not null and r.fraud_status = 'normal')::integer as retained,
  count(r.id) filter (where r.fraud_status = 'review')::integer                        as in_review,
  count(r.id) filter (where r.fraud_status = 'rejected')::integer                      as rejected,
  max(r.registered_at)                                                                 as last_join_at
from public.referral_campaigns c
left join public.referrals r on r.campaign_id = c.id
group by c.id, c.partner_name, c.code, c.active, c.starts_at, c.ends_at, c.notes;

grant select on public.referral_campaign_overview to authenticated;
