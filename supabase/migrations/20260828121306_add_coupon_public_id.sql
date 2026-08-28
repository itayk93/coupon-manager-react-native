-- Keep the integer primary key for existing foreign keys and add an opaque,
-- stable identifier for every URL and public API boundary.
alter table public.coupon
  add column public_id text
  default ('cpn_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));

-- The default fills existing rows when the column is added. Keep these
-- statements explicit so partially-applied or restored databases are safe too.
update public.coupon
set public_id = 'cpn_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)
where public_id is null;

alter table public.coupon
  alter column public_id set not null;

alter table public.coupon
  add constraint coupon_public_id_format
  check (public_id ~ '^cpn_[0-9a-f]{20}$');

create unique index coupon_public_id_key
  on public.coupon (public_id);
