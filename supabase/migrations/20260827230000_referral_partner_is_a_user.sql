-- A partner is an account, and their link is not their name.
--
-- Two corrections to how campaigns were made.
--
-- 1. The partner was a typed string. That reads fine until the person also has
--    an account — and they always do, because the arrangement starts with
--    someone who already uses the app. A name in a text column cannot be
--    joined to anything, so "did the partner themselves stay active" and "did
--    they try to claim their own link" were questions the data could not
--    answer. Now a campaign points at a row in `users`.
--
-- 2. The code could be chosen, and the obvious choice is the partner's name.
--    A link that says who it belongs to is a link that gets guessed, tried by
--    people it was never sent to, and shared onward with the name attached.
--    Codes are generated now, and only generated.
--
-- The seeded pilot goes with it: it was written in SQL as an example, it
-- carries a name-shaped code, and it never had a partner account behind it.

delete from public.referral_rewards
  where campaign_id in (select id from public.referral_campaigns where lower(code) = 'elior');
delete from public.referrals
  where campaign_id in (select id from public.referral_campaigns where lower(code) = 'elior');
delete from public.referral_codes
  where campaign_id in (select id from public.referral_campaigns where lower(code) = 'elior');
delete from public.referral_campaigns where lower(code) = 'elior';

-- Replaced rather than kept alongside: two ways to make a campaign means one
-- of them is the way nobody remembers has no partner account attached.
drop function if exists public.referral_create_campaign(text, text, text);

/**
 * Start a partner from an account, and hand back the code their link carries.
 *
 * The code is generated every time. A caller cannot pass one in, so there is
 * no path by which a link ends up spelling the person it belongs to.
 */
create or replace function public.referral_create_campaign_for_user(
  p_user_id integer,
  p_notes   text default null
)
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

  -- One live campaign per person. A second one would split their chain in two
  -- and make every total ambiguous; ending the first is what frees them up.
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

  insert into public.referral_campaigns as c (name, partner_name, partner_user_id, code, notes)
  values (
    coalesce(nullif(trim(coalesce(person.first_name, '') || ' ' || coalesce(person.last_name, '')), ''), person.email),
    coalesce(nullif(trim(coalesce(person.first_name, '') || ' ' || coalesce(person.last_name, '')), ''), person.email),
    p_user_id,
    wanted,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning c.id into new_id;

  perform public.referral_default_rewards(new_id);

  return query select new_id, wanted;
end;
$$;

grant execute on function public.referral_create_campaign_for_user(integer, text) to authenticated;

-- The overview carries the account now, so the admin screen can say which
-- person a partner is rather than which string was typed when they were added.
-- Dropped and rebuilt rather than replaced: `create or replace view` can add
-- columns at the end but not insert one in the middle.
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
  c.notes,
  count(r.id) filter (where r.fraud_status <> 'rejected')::integer                     as joined,
  count(r.id) filter (where r.activated_at is not null and r.fraud_status = 'normal')::integer as activated,
  count(r.id) filter (where r.retained_at  is not null and r.fraud_status = 'normal')::integer as retained,
  count(r.id) filter (where r.fraud_status = 'review')::integer                        as in_review,
  count(r.id) filter (where r.fraud_status = 'rejected')::integer                      as rejected,
  max(r.registered_at)                                                                 as last_join_at
from public.referral_campaigns c
left join public.users p on p.id = c.partner_user_id
left join public.referrals r on r.campaign_id = c.id
group by c.id, c.partner_name, c.partner_user_id, p.email, c.code, c.active, c.starts_at, c.ends_at, c.notes;

grant select on public.referral_campaign_overview to authenticated;
