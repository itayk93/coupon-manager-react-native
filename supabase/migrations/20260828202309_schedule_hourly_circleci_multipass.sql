do $$
begin
  perform cron.unschedule('hourly-multipass-update');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'hourly-multipass-update',
  '*/30 * * * *',
  $$select public.trigger_hourly_multipass_update();$$
);
