-- enrich-ip-geo cannot rely on an edge secret in this environment, so it reads
-- its expected cron token straight from the Vault via its service-role client.
-- service_role only; nothing else may see the secret.
create or replace function public.ip_geo_cron_token()
returns text
language sql
security definer
set search_path = public, extensions, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'ip_geo_cron_token' limit 1;
$$;

revoke all on function public.ip_geo_cron_token() from public, anon, authenticated;
grant execute on function public.ip_geo_cron_token() to service_role;
