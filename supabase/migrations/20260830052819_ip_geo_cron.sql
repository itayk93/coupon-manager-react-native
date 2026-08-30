-- Geo enrichment + IP retention plumbing.
--
-- Vault secrets required (created out-of-band, not in this migration):
--   enrich_ip_geo_function_url  = https://<ref>.supabase.co/functions/v1/enrich-ip-geo
--   ip_geo_cron_token           = shared secret, also set as the edge secret
--                                 IP_GEO_CRON_TOKEN on the enrich-ip-geo function.

-- A failed lookup must not be retried every run. Exclude any IP already in the
-- cache; reset_failed_ip_lookups() re-admits stale failures weekly.
create or replace function public.ip_geo_pending(p_limit int)
returns table (ip_address text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select distinct ua.ip_address from public.user_activities ua
  where ua.ip_address is not null
    and not exists (select 1 from public.ip_geo g where g.ip_address = ua.ip_address)
  limit p_limit;
$$;
revoke all on function public.ip_geo_pending(int) from public, anon, authenticated;

-- 90-day IP retention: strip PII from old activity rows (city/region stay),
-- then drop cache rows no live activity row still points at.
create or replace function public.strip_old_activity_ip()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.user_activities
    set ip_address = null, extra_metadata = null
  where "timestamp" < now() - interval '90 days' and ip_address is not null;

  delete from public.ip_geo g
  where g.resolved_at < now() - interval '90 days'
    and not exists (select 1 from public.user_activities ua where ua.ip_address = g.ip_address);
end;
$$;

-- Weekly: drop failed lookups older than 7 days so ip_geo_pending retries them
-- (a transient outage, or the provider gained coverage).
create or replace function public.reset_failed_ip_lookups()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.ip_geo
  where lookup_failed and resolved_at < now() - interval '7 days';
$$;

-- pg_cron -> edge function, same shape as trigger_hourly_multipass_update.
create or replace function public.trigger_enrich_ip_geo()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  u text;
  tok text;
begin
  select decrypted_secret into u   from vault.decrypted_secrets where name = 'enrich_ip_geo_function_url' limit 1;
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'ip_geo_cron_token' limit 1;
  if u is null or u = '' or tok is null or tok = '' then
    raise exception 'Missing Vault secret for enrich-ip-geo';
  end if;
  perform net.http_post(
    url := u,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', tok),
    body := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
end;
$$;

select cron.schedule('ip-geo-enrich',       '*/15 * * * *', $$select public.trigger_enrich_ip_geo();$$);
select cron.schedule('ip-geo-strip',        '0 3 * * *',    $$select public.strip_old_activity_ip();$$);
select cron.schedule('ip-geo-reset-failed', '0 4 * * 0',    $$select public.reset_failed_ip_lookups();$$);
