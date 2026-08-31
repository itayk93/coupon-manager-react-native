-- Run the retention jobs once during rollout. The scheduled jobs only cover
-- future daily runs and do not execute immediately when they are created.
select public.purge_stale_gpt_usage();
select public.strip_old_activity_ip();
