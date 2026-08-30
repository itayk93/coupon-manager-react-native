-- `reasons || 'literal'` is ambiguous in PG15 (array_append vs array_cat) and
-- resolves to array_cat, casting the string to text[] -> "malformed array
-- literal" the first time any signal actually fires. The inherited signals had
-- the same latent bug; none had triggered in prod. Switch every append to the
-- unambiguous `|| array['x']` form.
create or replace function public.referral_fraud_reasons(p_referral_id bigint)
 returns text[]
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  r        public.referrals;
  reasons  text[] := '{}';
  n        integer;
begin
  select * into r from public.referrals where id = p_referral_id;
  if not found then return reasons; end if;

  if r.install_hash is not null then
    select count(*) into n from public.referrals x where x.install_hash = r.install_hash;
    if n >= 3 then reasons := reasons || array['duplicate_install']; end if;
  end if;

  if r.direct_referrer_user_id is not null and exists (
    select 1 from public.referrals back
    where back.referred_user_id = r.direct_referrer_user_id
      and back.direct_referrer_user_id = r.referred_user_id
  ) then
    reasons := reasons || array['reciprocal_referral'];
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
  if n >= 5 then reasons := reasons || array['ip_burst']; end if;

  -- asn_burst: many referred users on one ISP/ASN within a day of each other,
  -- catching CGNAT and VPN pools where the IPs differ but the network does not.
  -- Large IL residential ISPs are muted; threshold 8 vs ip_burst's 5.
  select count(distinct b.referred_user_id) into n
  from public.referrals a
  join public.user_activities ua_a on ua_a.user_id = a.referred_user_id
  join public.ip_geo geo_a on geo_a.ip_address = ua_a.ip_address
  join public.ip_geo geo_b on geo_b.asn = geo_a.asn
  join public.user_activities ua_b on ua_b.ip_address = geo_b.ip_address
  join public.referrals b on b.referred_user_id = ua_b.user_id
  where a.id = p_referral_id
    and geo_a.asn is not null
    and geo_a.asn <> all (array[
      'AS8551','AS12400','AS1680','AS16116','AS8867','AS9116','AS39737'
    ]::text[])
    and b.campaign_id = r.campaign_id
    and abs(extract(epoch from (b.registered_at - r.registered_at))) < 86400;
  if n >= 8 then reasons := reasons || array['asn_burst']; end if;

  return reasons;
end;
$function$
