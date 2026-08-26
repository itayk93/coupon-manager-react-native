-- Let the alerts ledger hold a claim, not just a receipt.
--
-- send-expiry-alerts read the ledger, sent the mail, then wrote the row. Two
-- overlapping runs both read "nothing sent yet" and both send; the unique
-- constraint then dedupes the *rows*, which is far too late — the user already
-- has two emails. The row has to be taken before the send, so 'pending' is
-- now a legal status: insert it, send, then promote it to 'sent'.
--
-- A run that dies between claiming and sending leaves a stale 'pending' row;
-- the function reclaims anything older than an hour, which is longer than a
-- run can last and shorter than the gap to the next reminder.

alter table public.coupon_alerts
  drop constraint if exists coupon_alerts_status_check;

alter table public.coupon_alerts
  add constraint coupon_alerts_status_check
  check (status in ('sent', 'failed', 'skipped_pref', 'pending'));

create index if not exists coupon_alerts_pending_idx
  on public.coupon_alerts (sent_at)
  where status = 'pending';
