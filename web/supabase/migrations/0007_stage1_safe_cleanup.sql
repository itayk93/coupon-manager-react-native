-- Stage 1 safe cleanup
-- Date: 2026-08-01
--
-- Scope:
-- - Drop only low-risk legacy objects identified in DB_CLEANUP_AUDIT_2026-08-01.md
-- - Avoid tables/columns with active code usage, external integrations, or meaningful row counts
--
-- Included in this stage:
-- 1. public.coupon_requests
--    Reason: no code usage found, row count was 0 during audit, legacy marketplace/request flow
-- 2. public.users.dismissed_message_id
--    Reason: no code usage found
-- 3. public.users.dismissed_expiring_alert_at
--    Reason: no code usage found
-- 4. public.users.show_whatsapp_banner
--    Reason: no code usage found
-- 5. public.coupon.exclude_saving
--    Reason: no code usage found
-- 6. public.coupon.notification_sent_pagh_tokev
--    Reason: no code usage found
-- 7. public.coupon.notification_sent_nutzel
--    Reason: no code usage found
--
-- Explicitly NOT included:
-- - telegram_users
-- - user_activities
-- - scheduled_tasks
-- - task_execution_logs
-- - gpt_usage
-- - newsletter_sendings
-- - users.google_id
-- - users.slots_automatic_coupons
-- - coupon.strauss_coupon_url
-- - coupon.xtra_coupon_url
--
-- Run only after backup and final human approval.

begin;

drop table if exists public.coupon_requests;

alter table public.users
  drop column if exists dismissed_message_id,
  drop column if exists dismissed_expiring_alert_at,
  drop column if exists show_whatsapp_banner;

alter table public.coupon
  drop column if exists exclude_saving,
  drop column if exists notification_sent_pagh_tokev,
  drop column if exists notification_sent_nutzel;

commit;
