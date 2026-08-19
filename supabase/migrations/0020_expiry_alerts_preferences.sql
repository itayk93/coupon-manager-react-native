-- 0020: Expiry alerts — preferences, unified coupon_alerts ledger, native push
-- tokens, and the hourly send-expiry-alerts cron.
--
-- This replaces the four per-window `reminder_sent_*` booleans on `coupon` with
-- a deduplicating `coupon_alerts` table, and replaces the single all-or-nothing
-- `opt_outs.opted_out` for expiry mail with a real per-channel preference table
-- (`opt_outs` stays: it still governs marketing/newsletter consent).

-- 1. Per-user notification preferences ----------------------------------------
create table if not exists public.notification_preferences (
  user_id     integer primary key references public.users(id) on delete cascade,
  email       boolean not null default true,
  push        boolean not null default true,
  in_app      boolean not null default true,
  windows     integer[] not null default '{30,7,1,0}',
  quiet_until time,
  timezone    text not null default 'Asia/Jerusalem',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own
  on public.notification_preferences
  for all to authenticated
  using (user_id = public.app_user_id() or public.is_app_admin())
  with check (user_id = public.app_user_id() or public.is_app_admin());

-- 2. Add a native push channel next to the existing Web Push rows -------------
-- `subscription` stays NOT NULL for legacy rows and web rows; Expo rows carry
-- only expo_token, so the column must accept NULL from here on.
alter table public.push_subscriptions
  alter column subscription drop not null;

alter table public.push_subscriptions
  add column if not exists kind text not null default 'web'
    check (kind in ('web', 'expo')),
  add column if not exists expo_token text;

create index if not exists push_subscriptions_expo_token_idx
  on public.push_subscriptions (expo_token)
  where expo_token is not null;

-- kind='web' keeps the existing `subscription` jsonb. kind='expo' stores the
-- Expo push token in expo_token and uses a synthetic endpoint key so the
-- endpoint primary key stays unique and self-describing.
comment on column public.push_subscriptions.kind is
  'web = Web Push (VAPID), expo = Expo push token (APNs/FCM)';
comment on column public.push_subscriptions.expo_token is
  'Expo push token for kind=expo; null for web subscriptions';

-- 3. A send ledger instead of reminder flags on coupon ------------------------
create table if not exists public.coupon_alerts (
  id          bigserial primary key,
  coupon_id   integer not null references public.coupon(id) on delete cascade,
  user_id     integer not null references public.users(id) on delete cascade,
  window_days integer not null,
  channel     text not null check (channel in ('email', 'push', 'in_app')),
  sent_at     timestamptz not null default now(),
  status      text not null check (status in ('sent', 'failed', 'skipped_pref')),
  unique (coupon_id, window_days, channel)
);

create index if not exists coupon_alerts_user_id_idx on public.coupon_alerts (user_id);
create index if not exists coupon_alerts_coupon_id_idx on public.coupon_alerts (coupon_id);

alter table public.coupon_alerts enable row level security;

drop policy if exists coupon_alerts_own on public.coupon_alerts;
create policy coupon_alerts_own
  on public.coupon_alerts
  for all to authenticated
  using (user_id = public.app_user_id() or public.is_app_admin())
  with check (user_id = public.app_user_id() or public.is_app_admin());

-- 3a. The function matches expiry dates as exact YYYY-MM-DD strings, so a row
-- in any other shape would be skipped in silence. All 320 dated rows already
-- conform; this keeps it that way.
alter table public.coupon
  drop constraint if exists coupon_expiration_iso_date;
alter table public.coupon
  add constraint coupon_expiration_iso_date
  check (expiration is null or expiration ~ '^\d{4}-\d{2}-\d{2}$')
  not valid;
alter table public.coupon validate constraint coupon_expiration_iso_date;

-- 3b. Coupons whose reminder already went out keep it: seed the ledger from the
-- flags being retired below, so nobody is mailed twice about the same coupon.
insert into public.coupon_alerts (coupon_id, user_id, window_days, channel, status)
select c.id, c.user_id, w.days, 'email', 'sent'
  from public.coupon c
  cross join lateral (values
    (30, c.reminder_sent_30_days),
    (7,  c.reminder_sent_7_days),
    (1,  c.reminder_sent_1_day),
    (0,  c.reminder_sent_today)
  ) as w(days, was_sent)
 where w.was_sent = true
   and c.user_id is not null
on conflict (coupon_id, window_days, channel) do nothing;

-- 4. Retire the legacy per-window flags ---------------------------------------
-- The new ledger's unique(coupon_id, window_days, channel) is the dedup
-- mechanism, so the booleans are no longer read or written.
alter table public.coupon
  drop column if exists reminder_sent_30_days,
  drop column if exists reminder_sent_7_days,
  drop column if exists reminder_sent_1_day,
  drop column if exists reminder_sent_today;

-- 5. Seed preferences from the existing marketing opt-outs --------------------
-- Everything defaults to email = true. Without this, the first run would mail
-- people who had already asked to be left alone.
insert into public.notification_preferences (user_id, email)
select o.user_id, false
  from public.opt_outs o
  join public.users u on u.id = o.user_id
 where o.opted_out = true
on conflict (user_id) do update set email = false, updated_at = now();

-- 6. Hourly cron -------------------------------------------------------------
-- pg_cron cannot present a user JWT, and the service-role key is deliberately
-- not kept in Vault, so the scheduler authenticates with a dedicated token that
-- grants exactly one thing: the right to start a run. Both halves must exist:
--
--   Vault (created out of band, never committed — the token is a secret):
--     select vault.create_secret('<function url>', 'send_expiry_alerts_function_url');
--     select vault.create_secret('<random token>', 'send_expiry_alerts_cron_token');
--   Edge Function secret (set by hand, must equal the Vault token):
--     supabase secrets set EXPIRY_CRON_TOKEN=<token>

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_send_expiry_alerts()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  function_url text;
  cron_token text;
begin
  select decrypted_secret into function_url
    from vault.decrypted_secrets where name = 'send_expiry_alerts_function_url' limit 1;

  select decrypted_secret into cron_token
    from vault.decrypted_secrets where name = 'send_expiry_alerts_cron_token' limit 1;

  if function_url is null or function_url = '' then
    raise exception 'Missing Vault secret: send_expiry_alerts_function_url';
  end if;

  if cron_token is null or cron_token = '' then
    raise exception 'Missing Vault secret: send_expiry_alerts_cron_token';
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'X-Cron-Token', cron_token,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.trigger_send_expiry_alerts() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('send-expiry-alerts');
exception
  when others then
    null;
end;
$$;

-- Hourly, not daily. A user's quiet_until says "not before this local hour";
-- with a once-a-day run anybody whose hour had not arrived was skipped for good.
-- The coupon_alerts ledger is read before sending, so the extra runs are free.
select cron.schedule(
  'send-expiry-alerts',
  '0 * * * *',
  $$select public.trigger_send_expiry_alerts();$$
);

-- 7. Keep updated_at honest ---------------------------------------------------
create or replace function public.touch_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.touch_notification_preferences() from public, anon, authenticated;

drop trigger if exists notification_preferences_touch on public.notification_preferences;
create trigger notification_preferences_touch
  before update on public.notification_preferences
  for each row execute function public.touch_notification_preferences();
