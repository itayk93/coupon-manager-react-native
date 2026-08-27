-- The pilot, and the clock that keeps it current.
--
-- One campaign, one partner, three thresholds — deliberately small. Nothing
-- here opens referrals to everyone: a person only gets a personal code once
-- they have been attributed to a campaign, so the chain can only grow from
-- this single root until someone decides otherwise.

insert into public.referral_campaigns (name, partner_name, code, notes)
values ('Elior Pilot', 'אליאור', 'ELIOR',
        'First referral pilot. Two Dream Cards for activation, cash for retention.')
on conflict (lower(code)) do nothing;

insert into public.referral_rewards (campaign_id, label, metric, threshold, reward_type, reward_value)
select c.id, v.label, v.metric, v.threshold, v.reward_type, v.reward_value
from public.referral_campaigns c
cross join (values
  ('10 משתמשים מופעלים', 'activated', 10, 'dream_card', 50.00),
  ('25 משתמשים מופעלים', 'activated', 25, 'dream_card', 50.00),
  ('25 משתמשים שנשארו',  'retained',  25, 'cash',      100.00)
) as v(label, metric, threshold, reward_type, reward_value)
where lower(c.code) = 'elior'
on conflict (campaign_id, metric, threshold) do nothing;

-- Hourly, because the numbers a partner is watching should move on their own.
-- No HTTP hop: the work is three queries over two tables, so the job is the
-- function itself rather than a request to an edge function that would then
-- connect back to this same database.
do $$
begin
  perform cron.unschedule('referral-progress-hourly');
exception when others then null;
end;
$$;

select cron.schedule(
  'referral-progress-hourly',
  '17 * * * *',
  $$select public.refresh_referral_progress();$$
);
