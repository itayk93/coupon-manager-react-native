-- 0015: Harden legacy widget RPC surface.
--
-- get_widget_coupons(p_user_id) and get_widget_statistics(p_user_id) were
-- flagged in SECURITY_REVIEW.md as SECURITY DEFINER functions reachable by
-- `anon`. The current home-screen widget no longer calls these RPCs — it reads
-- precomputed data from shared storage (modules/coupon-widget), so removing
-- anonymous execute access is safe.
--
-- This closes the anonymous IDOR surface. The function bodies themselves should
-- still be reviewed to ensure they verify p_user_id against the caller when
-- executed by `authenticated`.

revoke execute on function public.get_widget_coupons(integer) from anon;
revoke execute on function public.get_widget_statistics(integer) from anon;
grant execute on function public.get_widget_coupons(integer) to authenticated;
grant execute on function public.get_widget_statistics(integer) to authenticated;

-- The remaining legacy widget functions can stay service-role-only: nothing in
-- the current app or widget calls them anonymously anymore.
revoke execute on function public.get_widget_companies() from anon;
revoke execute on function public.mark_coupon_as_used_rpc(integer) from anon;
revoke execute on function public.trigger_hourly_multipass_update() from anon;
