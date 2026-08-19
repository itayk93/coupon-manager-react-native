-- 0021: Match the new alert tables to the grant model set in 0011.
--
-- Both tables were created with the default grants, which hand `anon` full
-- table privileges. RLS still filtered every row, so nothing leaked — the
-- REST API answered an empty array rather than refusing. Every other table in
-- this schema refuses outright, and the anon key is public, so close the gap:
-- an unauthenticated caller has no business reaching these at all.
--
-- push_subscriptions is left alone; it is already service-role only.

revoke all on public.notification_preferences from anon;
revoke all on public.coupon_alerts from anon;

-- The ledger is written by the send-expiry-alerts function under the service
-- role. Signed-in users only ever need to read their own rows.
revoke insert, update, delete, truncate, references, trigger
  on public.coupon_alerts from authenticated;
