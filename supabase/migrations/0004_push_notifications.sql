create table if not exists public.push_system_config (
  id bigint primary key,
  vapid_public_key text not null,
  vapid_private_key text not null,
  vapid_subject text not null default 'mailto:push@couponmaster.app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  user_id bigint not null,
  user_email text not null,
  platform text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index if not exists push_subscriptions_user_email_idx on public.push_subscriptions(user_email);

alter table public.push_system_config enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "No direct access to push_system_config" on public.push_system_config;
create policy "No direct access to push_system_config"
on public.push_system_config
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "No direct access to push_subscriptions" on public.push_subscriptions;
create policy "No direct access to push_subscriptions"
on public.push_subscriptions
for all
to anon, authenticated
using (false)
with check (false);
