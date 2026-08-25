-- Daily expiry reminders.
--
-- The fixed windows (30/7/1/0) leave gaps: a coupon expiring in 13 days
-- matches nothing and the user hears about it only on day 7. This column opts
-- a user into a reminder on *every* day inside the final stretch.
--
-- Stored as the length of that stretch in days rather than a boolean so the
-- reach is tunable without another migration. NULL means off; the fixed
-- windows keep working either way, and the coupon_alerts ledger already
-- dedupes per (coupon, window_days, channel), so each day sends at most once.

alter table public.notification_preferences
  add column if not exists daily_within integer
    check (daily_within is null or (daily_within between 1 and 30));

comment on column public.notification_preferences.daily_within is
  'Send a reminder every day once a coupon is within this many days of expiry. NULL = off.';
