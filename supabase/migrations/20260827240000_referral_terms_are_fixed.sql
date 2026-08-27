-- The terms are the terms.
--
-- Campaigns briefly carried a free-text note and an editable reward ladder, so
-- every partner could be on a different arrangement. That is a real thing some
-- programmes need and not the thing this one is: there is one offer — 10 and
-- 25 activated users, 25 retained — and every partner is on it.
--
-- Removing the ability to vary it removes the questions that come with it:
-- which rung applies to whom, why two partners at the same count are owed
-- different amounts, and what a half-filled note column meant a year later.
-- A ladder that is the same everywhere can be read straight off the code.

drop function if exists public.referral_upsert_reward(bigint, text, integer, text, numeric, text);
drop function if exists public.referral_delete_reward(bigint);

-- `notes` goes with them. It was only ever going to hold a paraphrase of the
-- terms, and a paraphrase that can drift from the ladder is worse than none.
drop view if exists public.referral_campaign_overview;

alter table public.referral_campaigns drop column if exists notes;

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
  count(r.id) filter (where r.fraud_status <> 'rejected')::integer                     as joined,
  count(r.id) filter (where r.activated_at is not null and r.fraud_status = 'normal')::integer as activated,
  count(r.id) filter (where r.retained_at  is not null and r.fraud_status = 'normal')::integer as retained,
  count(r.id) filter (where r.fraud_status = 'review')::integer                        as in_review,
  count(r.id) filter (where r.fraud_status = 'rejected')::integer                      as rejected,
  max(r.registered_at)                                                                 as last_join_at
from public.referral_campaigns c
left join public.users p on p.id = c.partner_user_id
left join public.referrals r on r.campaign_id = c.id
group by c.id, c.partner_name, c.partner_user_id, p.email, c.code, c.active, c.starts_at, c.ends_at;

grant select on public.referral_campaign_overview to authenticated;

drop function if exists public.referral_create_campaign_for_user(integer, text);

/**
 * Turn one of your users into a partner, and hand back the code their link
 * carries. No terms to pass: every campaign opens on the same ladder.
 */
create or replace function public.referral_create_campaign_for_user(p_user_id integer)
returns table (id bigint, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  person   record;
  wanted   text;
  new_id   bigint;
  attempts integer := 0;
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;

  select u.id, u.email, u.first_name, u.last_name
    into person
    from public.users u
   where u.id = p_user_id and u.is_deleted is not true;
  if not found then raise exception 'no such user'; end if;

  -- One live campaign per person. A second would split their chain in two and
  -- make every total ambiguous; ending the first is what frees them up.
  if exists (
    select 1 from public.referral_campaigns c
    where c.partner_user_id = p_user_id and c.active
  ) then
    raise exception 'that user already has an active campaign';
  end if;

  loop
    wanted := public.referral_random_code();
    exit when not public.referral_code_taken(wanted);
    attempts := attempts + 1;
    if attempts > 20 then raise exception 'could not generate a free code'; end if;
  end loop;

  insert into public.referral_campaigns as c (name, partner_name, partner_user_id, code)
  values (
    coalesce(nullif(trim(coalesce(person.first_name, '') || ' ' || coalesce(person.last_name, '')), ''), person.email),
    coalesce(nullif(trim(coalesce(person.first_name, '') || ' ' || coalesce(person.last_name, '')), ''), person.email),
    p_user_id,
    wanted
  )
  returning c.id into new_id;

  perform public.referral_default_rewards(new_id);

  return query select new_id, wanted;
end;
$$;

grant execute on function public.referral_create_campaign_for_user(integer) to authenticated;
