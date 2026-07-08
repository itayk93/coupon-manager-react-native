-- Migration: constraints, realtime, and scheduled tasks for the new features.
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

-- 1. Unique constraints needed for the client-side upserts ---------------------

-- opt_outs: one row per user (useConsent.useSetOptOut upserts on user_id)
alter table public.opt_outs
  add constraint opt_outs_user_id_key unique (user_id);

-- coupon_active_viewers: one row per (coupon, user, session) for heartbeat upsert
alter table public.coupon_active_viewers
  add constraint coupon_active_viewers_unique
  unique (coupon_id, user_id, session_id);

-- 2. Realtime for live "who is viewing" ---------------------------------------
alter publication supabase_realtime add table public.coupon_active_viewers;

-- 3. Seed the scheduled tasks the admin panel manages -------------------------
insert into public.scheduled_tasks (task_name, task_type, schedule_type, execution_time, timezone, is_active, description)
values
  ('תזכורות תפוגת קופונים', 'expiration_reminders', 'daily', '09:00', 'Asia/Jerusalem', true,
   'שולח תזכורות מייל לקופונים שעומדים לפוג בעוד 30/7/1 ימים'),
  ('עדכון יתרות אוטומטי', 'auto_update', 'daily', '03:00', 'Asia/Jerusalem', false,
   'מרענן יתרות של קופוני Multipass/BuyMe דרך שירות הסקרייפר'),
  ('ניקוי צופים לא פעילים', 'cleanup_viewers', 'hourly', '00:00', 'Asia/Jerusalem', true,
   'מוחק רשומות coupon_active_viewers ישנות')
on conflict do nothing;

-- 4. pg_cron schedules (requires the pg_cron + pg_net extensions) --------------
-- Enable once in the Supabase dashboard: Database > Extensions > pg_cron, pg_net.
-- Replace <PROJECT_REF> and <ANON_OR_SERVICE_KEY> below before running.
--
-- Daily expiration reminders at 06:00 UTC (09:00 Israel):
--   select cron.schedule(
--     'expiration-reminders',
--     '0 6 * * *',
--     $$ select net.http_post(
--          url := 'https://<PROJECT_REF>.functions.supabase.co/send-emails',
--          headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_KEY>"}'::jsonb,
--          body := '{"mode":"expiration_reminders"}'::jsonb
--        ); $$
--   );
--
-- Hourly cleanup of stale viewers:
--   select cron.schedule(
--     'cleanup-viewers',
--     '0 * * * *',
--     $$ delete from public.coupon_active_viewers
--        where last_activity < now() - interval '5 minutes'; $$
--   );
