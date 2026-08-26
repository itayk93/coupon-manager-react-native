-- Keep coupon codes out of the marketplace row.
--
-- `coupon_marketplace_select` lets any signed-in user read a coupon whose
-- is_for_sale is true. That is the intended feature — but a policy grants the
-- whole row, so the listing carried `code`, `cvv`, `card_exp` and the
-- redemption URLs along with the price. Anyone signed in could ask PostgREST
-- for them directly:
--
--   GET /rest/v1/coupon?select=code,cvv&is_for_sale=eq.true
--
-- The app never asks for that, which is exactly why it would not have been
-- noticed: the UI shows a price, the API hands over the coupon. Nothing today
-- leaks — both listed coupons have an empty code — but the next seller to list
-- a real one would.
--
-- Column-level SELECT is the right gate rather than a narrower policy: the app
-- reads these columns only through the coupon-vault function, which runs as the
-- service role and checks ownership itself. The client's own direct reads of
-- this table are `select('value, status')` and two deletes, none of which touch
-- a secret column.

-- A column-level revoke cannot subtract from a table-wide grant, so the
-- table-level SELECT has to go and be re-issued column by column. A redemption
-- URL is as good as the code, so it is withheld too.
revoke select on public.coupon from authenticated;

grant select (
  id, value, cost, company, description, expiration, date_added,
  used_value, status, user_id, is_for_sale, is_one_time, purpose,
  auto_download_details, source, auto_update,
  last_detail_view, last_company_view, last_code_view, last_scraped,
  show_in_widget, widget_display_order
) on public.coupon to authenticated;

comment on policy coupon_marketplace_select on public.coupon is
  'Marketplace listings. Secret columns are withheld by column-level grants, not by this policy — see migration 20260826120000.';
