-- 0019: Drop four coupon columns nothing reads.
--
-- Each appeared only inside COUPON_COLUMNS in src/lib/tableColumns.ts — fetched
-- on every coupon query and never read. No policy, function, index or trigger
-- referenced them, and the app has no select('*') anywhere that could break.
--
--   company_id            NULL in all 434 rows; the app matches on the
--                         `company` text instead. Drops fk_company with it.
--   is_available          true in 419 rows, NULL in 15, never false.
--   special_message       one row, a note the SwiftUI detail view used to show.
--   discount_percentage   43 rows; derivable from value and cost.
--
-- reminder_sent_today is deliberately NOT dropped. It is the flag for a fourth
-- expiry-reminder window ("expires today") that the Flask scheduler sent until
-- early 2025 and that send-emails does not implement yet — see
-- docs/EXPIRY_ALERTS_PLAN.md.
--
-- Values were exported first.

alter table public.coupon drop column if exists company_id;
alter table public.coupon drop column if exists is_available;
alter table public.coupon drop column if exists special_message;
alter table public.coupon drop column if exists discount_percentage;
