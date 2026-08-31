-- A transferred coupon can later be sold by its new owner. Only simultaneous
-- open sales conflict; completed sales remain an append-only ownership trail.
drop index if exists public.coupon_sales_one_open_sale_per_coupon;
create unique index coupon_sales_one_open_sale_per_coupon
  on public.coupon_sales(coupon_id) where status = 'pending';
