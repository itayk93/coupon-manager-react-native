-- The marketplace is gone from the app: no screen lists coupons for sale, no
-- code sets the flag, and nothing reads it except two expressions that exclude
-- listed coupons from the wallet totals.
--
-- What was left was the policy. coupon_marketplace_select granted every signed
-- in account SELECT on any coupon with is_for_sale = true, a feature with no
-- caller still holding its exposure open. Migration 20260826120000 had already
-- taken code and cvv out of it with column grants; the rest of the row —
-- company, value, expiration — was still readable by anyone.
--
-- Two rows carried the flag when this ran: coupon 519 (user 37, Love Gift Card)
-- and coupon 522 (user 39, סינמה סיטי). Both had an empty code and no cvv, so
-- nothing sensitive was ever reachable through the policy. They are now
-- ordinary coupons and count toward their owners' balance like any other,
-- which is what dropping the concept means.
--
-- The policy goes first: the column cannot be dropped while it is named by one.
drop policy if exists coupon_marketplace_select on public.coupon;

-- The column-level grant on is_for_sale goes with the column.
alter table public.coupon drop column if exists is_for_sale;
