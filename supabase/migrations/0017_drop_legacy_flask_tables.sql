-- 0017: Drop the tables that belonged to the retired Flask site.
--
-- coupon_manager_project (the Flask app) was stripped down to a single
-- "we moved" page and no longer opens a database connection, so the tables it
-- owned have no reader left. None of them are referenced by the React Native
-- app or by any Edge Function, none carries an incoming foreign key, and the
-- only trigger involved (update_notification_settings_updated_at) served
-- notification_settings alone.
--
-- Contents were exported to JSON before the drop (725 rows in total, mostly
-- daily_email_status). Kept outside the repo.
--
--   transactions           0 rows  -- superseded by coupon_shares
--   user_ratings           0 rows
--   user_reviews           4 rows  -- last written 2025-03-01
--   daily_email_status   715 rows  -- last written 2025-08-31
--   bot_settings           4 rows  -- last written 2025-09-01
--   notification_settings  1 row
--   alembic_version        1 row   -- Alembic's own bookkeeping

drop table if exists public.transactions;
drop table if exists public.user_ratings;
drop table if exists public.user_reviews;
drop table if exists public.daily_email_status;
drop table if exists public.bot_settings;
drop table if exists public.notification_settings;
drop table if exists public.alembic_version;

drop function if exists public.update_notification_settings_updated_at();
