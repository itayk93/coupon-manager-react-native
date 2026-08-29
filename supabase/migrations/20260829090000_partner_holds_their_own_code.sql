-- A partner could not see their own invite link.
--
-- `referral_create_campaign_for_user` wrote the code into `referral_campaigns`
-- and stopped there. But `my_referral_status` — the whole of what the invite
-- screen reads — selects from `referral_codes`, and the only thing that ever
-- wrote that table was `claim_referral`, which runs when somebody is
-- *attributed*. The partner is the one person in a chain who never is. So the
-- account the pilot is built around opened "הזמנת חברים" and was told invites
-- were not open for it, while their link sat in the admin panel waiting to be
-- copied into WhatsApp by hand.
--
-- The partner keeps the campaign's own code rather than getting a second one.
-- Two codes for one person would be two links to explain, and the admin screen
-- already handed the campaign code over as *the* link. `referral_resolve_code`
-- is indifferent: the campaign branch yields (campaign, partner, depth 1) and
-- the personal branch, for someone with no referral row of their own, yields
-- exactly the same triple. Whichever arm of the union wins, the answer is one
-- answer, so the ambiguity is real but empty.

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

  -- The line this function was missing. A partner who was already somebody
  -- else's referral keeps the code they have — overwriting it would break the
  -- links they have already sent — so their new campaign simply adopts it.
  insert into public.referral_codes (user_id, code, campaign_id)
  values (p_user_id, wanted, new_id)
  on conflict (user_id) do update
    set campaign_id = excluded.campaign_id,
        revoked_at  = null;

  return query select new_id, wanted;
end;
$$;

grant execute on function public.referral_create_campaign_for_user(integer) to authenticated;

-- Partners created before this fix have a campaign and no code. Same rule as
-- above: adopt the campaign's code, leave an existing personal code alone.
insert into public.referral_codes (user_id, code, campaign_id)
select c.partner_user_id, c.code, c.id
from public.referral_campaigns c
where c.partner_user_id is not null
  and c.active
on conflict (user_id) do update
  set campaign_id = excluded.campaign_id,
      revoked_at  = null;
