-- The Python web app (coupon_manager_project) is retired. This RN repo is the
-- only DB consumer now. These three tables have no reader or writer anywhere in
-- the app, edge functions, DB functions, or cron.
--   scheduled_tasks / task_execution_logs : 0 rows, admin hooks never wired to a screen
--   telegram_users                        : 8 stale rows, last write 2026-05-07

begin;

drop table if exists public.task_execution_logs;  -- FK -> scheduled_tasks, drop first
drop table if exists public.scheduled_tasks;
drop table if exists public.telegram_users;

commit;
