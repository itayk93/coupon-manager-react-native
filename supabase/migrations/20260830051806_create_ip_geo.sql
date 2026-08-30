-- IP -> location cache. One row per distinct IP ever seen in user_activities.
-- Pruned after 90 days by strip_old_activity_ip(): the only long-lived value
-- (city/region) is copied onto the activity rows by enrich-ip-geo.
create table public.ip_geo (
  ip_address    text primary key,
  city          text,
  region        text,
  country_code  text,
  isp           text,
  asn           text,                       -- "AS####", for the referral asn_burst signal
  source        text not null,              -- 'ipinfo' | 'ipwho' | 'legacy' | 'none'
  resolved_at   timestamptz not null default now(),
  lookup_failed boolean not null default false
);

-- service_role (the edge functions) bypasses RLS; authenticated/anon get nothing.
alter table public.ip_geo enable row level security;

create index idx_ip_geo_asn   on public.ip_geo (asn) where asn is not null;
create index idx_ip_geo_stale on public.ip_geo (resolved_at) where not lookup_failed;

-- IPs present in activity but not yet resolved. Kept server-side so enrich-ip-geo
-- stays a thin worker and the query is testable.
create function public.ip_geo_pending(p_limit int)
returns table (ip_address text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select distinct ua.ip_address from public.user_activities ua
  where ua.ip_address is not null
    and not exists (
      select 1 from public.ip_geo g
      where g.ip_address = ua.ip_address and not g.lookup_failed
    )
  limit p_limit;
$$;

revoke all on function public.ip_geo_pending(int) from public, anon, authenticated;
