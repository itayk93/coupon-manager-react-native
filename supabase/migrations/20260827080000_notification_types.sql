-- Notifications grow from one kind to nine.
--
-- Until now the only thing that could reach a user was an expiry reminder, so
-- a row in `notifications` needed no way of saying what it was, and the three
-- preference switches (email / push / in_app) were enough: they described the
-- one message the system could send.
--
-- Now the app tells someone their month's savings, that money is sitting
-- unused, that a coupon was shared with them, that a balance moved, that they
-- finished a coupon, that they passed a milestone, and — once — that a coupon
-- expired unused. Nine kinds behind one switch means the first unwanted
-- message costs every other message too, so each kind carries its own choice.

-- 1. What a notification is ---------------------------------------------------

alter table public.notifications
  add column if not exists type text,
  add column if not exists title text;

comment on column public.notifications.type is
  'Which kind of notification this is. Matches an id in _shared/notificationTypes.ts.';
comment on column public.notifications.title is
  'Short headline shown above the message. Null on rows written before types existed.';

-- The feed asks one question — this user, newest first — and it is about to be
-- asked far more often than it was when only expiry wrote here.
create index if not exists notifications_user_time_idx
  on public.notifications (user_id, timestamp desc);

-- 2. Per-kind channel choices -------------------------------------------------
--
-- One jsonb column rather than a column per kind: the set of kinds is expected
-- to keep growing, and each new one would otherwise be a migration, a client
-- release, and a window where the two disagree. Shape:
--   {"monthly_summary": {"push": true, "email": false}, ...}
-- A missing kind, or a missing channel inside one, means "use the default for
-- that kind" — so a kind added later reaches existing users without a backfill.

alter table public.notification_preferences
  add column if not exists type_channels jsonb not null default '{}'::jsonb;

comment on column public.notification_preferences.type_channels is
  'Per-notification-kind channel overrides. Absent kind or channel = that kind''s default. The three top-level email/push/in_app columns remain the master switches.';

-- 3. A ledger, so a once-only message is sent once ----------------------------
--
-- The periodic kinds are recomputed from coupon rows on every run: the monthly
-- summary is true all month, idle money stays idle, a passed milestone stays
-- passed. Without a record of what was already said, every run would say it
-- again. The dedupe key is what makes a kind repeatable on the right cadence —
-- '2026-08' for a monthly summary, the coupon id for a one-off about a coupon,
-- the threshold for a milestone.

create table if not exists public.notification_events (
  id bigserial primary key,
  user_id bigint not null references public.users (id) on delete cascade,
  type text not null,
  dedupe_key text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists notification_events_unique_idx
  on public.notification_events (user_id, type, dedupe_key);

alter table public.notification_events enable row level security;

-- Written and read only by the functions that send. Nothing the client does
-- depends on seeing it, and a client that could write it could silence itself
-- by claiming every key.
revoke all on public.notification_events from authenticated, anon;

-- 4. The nightly sweep --------------------------------------------------------
--
-- Same shape as trigger_send_expiry_alerts: pg_cron has no JWT, so it presents
-- a token from the vault that authorises exactly one thing — starting a run.
--
-- Runs hourly rather than daily for the same reason the expiry job does: a user
-- inside their quiet window is skipped, and a once-a-day run would skip them
-- for good. The notification_events ledger makes the extra runs free.

create or replace function public.trigger_send_engagement_alerts()
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
    from vault.decrypted_secrets where name = 'send_engagement_alerts_function_url' limit 1;

  select decrypted_secret into cron_token
    from vault.decrypted_secrets where name = 'send_engagement_alerts_cron_token' limit 1;

  -- Falls back to the expiry job's token so a single secret can drive both.
  if cron_token is null or cron_token = '' then
    select decrypted_secret into cron_token
      from vault.decrypted_secrets where name = 'send_expiry_alerts_cron_token' limit 1;
  end if;

  if function_url is null or function_url = '' then
    raise exception 'Missing Vault secret: send_engagement_alerts_function_url';
  end if;

  if cron_token is null or cron_token = '' then
    raise exception 'Missing Vault secret: send_engagement_alerts_cron_token';
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

revoke execute on function public.trigger_send_engagement_alerts() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('send-engagement-alerts');
exception
  when others then
    null;
end;
$$;

-- Half past the hour, so it does not contend with the expiry job on the hour.
select cron.schedule(
  'send-engagement-alerts',
  '30 * * * *',
  $$select public.trigger_send_engagement_alerts();$$
);
