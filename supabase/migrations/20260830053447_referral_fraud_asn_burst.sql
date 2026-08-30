-- Add an asn_burst signal to the referral fraud heuristics.
--
-- ip_burst already catches "many referred users, one IP". Mobile networks
-- dodge it: every device gets a different IP. asn_burst counts distinct
-- referred users sharing the same ASN (ISP network) within 24h of each other's
-- registration. Large IL residential ISPs are excluded - half the country
-- shares those - and the threshold is 8 rather than 5.
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

  -- asn_burst: many referred users on one ISP/ASN within a day of each other,
  -- catching CGNAT and VPN pools where the IPs differ but the network does not.
  -- Large IL residential ISPs are muted: half the country shares those ASNs, so
  -- the threshold is also higher (8, vs 5 for ip_burst).
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
      'AS8551',   -- Bezeq
      'AS12400',  -- Partner
      'AS1680',   -- 013 NetVision / Cellcom
      'AS16116',  -- Pelephone
      'AS8867',   -- HOT
      'AS9116',   -- Golden Lines / 012
      'AS39737'   -- 012 Smile
    ]::text[])
    and b.campaign_id = r.campaign_id
    and abs(extract(epoch from (b.registered_at - r.registered_at))) < 86400;
  if n >= 8 then reasons := reasons || 'asn_burst'; end if;

  return reasons;
end;
$function$
