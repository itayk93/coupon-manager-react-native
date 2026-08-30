-- These run only from pg_cron (as the table owner). Nothing should reach them
-- over PostgREST. Matches the lockdown on trigger_hourly_multipass_update.
revoke all on function public.trigger_enrich_ip_geo()   from public, anon, authenticated;
revoke all on function public.strip_old_activity_ip()    from public, anon, authenticated;
revoke all on function public.reset_failed_ip_lookups()  from public, anon, authenticated;
