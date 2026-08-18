-- 0016: Close the anonymous RPC surface for real.
--
-- 0015 revoked EXECUTE from `anon`, but every one of these functions still
-- carried the default `GRANT EXECUTE TO PUBLIC` (`=X/postgres` in proacl).
-- PUBLIC covers anon and authenticated, so the revoke had no effect: any
-- holder of the anon key could still call
--   POST /rest/v1/rpc/get_widget_coupons  {"p_user_id": <n>}
-- and enumerate every user's coupon codes. Nothing in the app calls these
-- RPCs (no `.rpc(` call sites outside generated types), so the whole surface
-- is revoked down to service_role.

revoke execute on function public.get_widget_coupons(integer) from public, anon, authenticated;
revoke execute on function public.get_widget_statistics(integer) from public, anon, authenticated;
revoke execute on function public.get_widget_companies() from public, anon, authenticated;
revoke execute on function public.get_consolidated_transactions(integer) from public, anon, authenticated;
revoke execute on function public.mark_coupon_as_used_rpc(integer) from public, anon, authenticated;
revoke execute on function public.trigger_hourly_multipass_update() from public, anon, authenticated;

-- Trigger-only functions: never called over the REST API.
revoke execute on function public.guard_users_self_update() from public, anon, authenticated;
revoke execute on function public.handle_auth_user_created() from public, anon, authenticated;
revoke execute on function public.log_telegram_users_changes() from public, anon, authenticated;
revoke execute on function public.update_notification_settings_updated_at() from public, anon, authenticated;

-- RLS helpers must stay callable by `authenticated` — the policies in 0010/0011
-- evaluate them as the calling role. Only PUBLIC/anon lose access.
revoke execute on function public.app_user_id() from public, anon;
revoke execute on function public.is_app_admin() from public, anon;
grant execute on function public.app_user_id() to authenticated;
grant execute on function public.is_app_admin() to authenticated;

-- Pin search_path on the functions the linter flagged as mutable.
alter function public.mark_coupon_as_used_rpc(integer) set search_path = public;
alter function public.log_telegram_users_changes() set search_path = public;
alter function public.get_widget_coupons(integer) set search_path = public;
alter function public.get_widget_companies() set search_path = public;
alter function public.get_widget_statistics(integer) set search_path = public;
alter function public.update_notification_settings_updated_at() set search_path = public;
