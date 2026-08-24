alter table public.coupon_usage
  add column if not exists place_name text,
  add column if not exists place_address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.coupon_usage
  add constraint coupon_usage_latitude_check
  check (latitude is null or latitude between -90 and 90);

alter table public.coupon_usage
  add constraint coupon_usage_longitude_check
  check (longitude is null or longitude between -180 and 180);
