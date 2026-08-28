create or replace function public.trigger_hourly_multipass_update()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  function_url text;
  anon_key text;
  cron_token text;
begin
  select decrypted_secret into function_url
    from vault.decrypted_secrets
   where name = 'multipass_update_function_url'
   limit 1;

  select decrypted_secret into anon_key
    from vault.decrypted_secrets
   where name = 'supabase_anon_key'
   limit 1;

  select decrypted_secret into cron_token
    from vault.decrypted_secrets
   where name = 'multipass_cron_token'
   limit 1;

  if function_url is null or function_url = '' then
    raise exception 'Missing Vault secret: multipass_update_function_url';
  end if;

  if anon_key is null or anon_key = '' then
    raise exception 'Missing Vault secret: supabase_anon_key';
  end if;

  if cron_token is null or cron_token = '' then
    raise exception 'Missing Vault secret: multipass_cron_token';
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key,
      'X-Cron-Token', cron_token,
      'Content-Type', 'application/json'
    ),
    body := '{"user_id":1}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;
