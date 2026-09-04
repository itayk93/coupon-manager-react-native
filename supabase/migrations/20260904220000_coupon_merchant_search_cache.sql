create table if not exists public.coupon_merchant_search_cache (
  user_id bigint not null references public.users(id) on delete cascade,
  normalized_query text not null,
  result jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, normalized_query),
  constraint coupon_merchant_search_cache_user_one_only check (user_id = 1),
  constraint coupon_merchant_search_cache_query_length check (char_length(normalized_query) between 2 and 80)
);

alter table public.coupon_merchant_search_cache enable row level security;
revoke all on table public.coupon_merchant_search_cache from public, anon, authenticated;

comment on table public.coupon_merchant_search_cache is
  'Server-only GPT web-search results for the maintainer coupon wallet.';
