-- 0018: Drop coupon.company_display_order and its index.
--
-- The column held a manual ordering of coupons inside a company screen. It was
-- introduced by the SwiftUI app (CouponManagerApp,
-- Database/2025-11-01_add_company_display_order.sql) and read only there, by
-- CompanyCouponsOrderingView. That app was last touched 2026-05-05 and the
-- ordering was never ported to this one: COUPON_COLUMNS selected the column and
-- nothing ever read the value. No policy, function or constraint referenced it.
--
-- 283 rows carried a value, 235 of them for user_id 1, and most were the
-- original backfill (row_number over date_added desc) rather than anything a
-- person arranged. Values and a restore guide were exported before the drop.

drop index if exists public.idx_coupon_company_display_order;

alter table public.coupon drop column if exists company_display_order;
