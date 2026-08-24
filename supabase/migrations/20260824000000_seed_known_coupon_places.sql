insert into public.coupon_places (
  normalized_name,
  place_name,
  place_address,
  source
)
values (
  'גוד פארם יהודה הלוי תל אביב',
  'גוד פארם יהודה הלוי תל אביב',
  'יהודה הלוי 45, תל אביב',
  'verified_business_directory'
)
on conflict (normalized_name) do update set
  place_address = excluded.place_address,
  updated_at = now();
