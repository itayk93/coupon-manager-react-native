-- Preserve effective table privileges explicitly for every current public table.
-- Do not grant table-wide SELECT on users/coupon: their column allowlists
-- protect passwords and encrypted coupon fields. Existing column grants and
-- RLS policies remain unchanged. Historical CREATE TABLE migrations also
-- declare grants so fresh tables do not rely on platform default privileges.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.admin_messages,
  public.admin_settings,
  public.auto_update_runs,
  public.companies,
  public.coupon_active_viewers,
  public.coupon_shares,
  public.coupon_tags,
  public.coupon_transaction,
  public.coupon_usage,
  public.feature_access,
  public.gpt_usage,
  public.ip_geo,
  public.newsletter_sendings,
  public.newsletters,
  public.notification_preferences,
  public.notifications,
  public.opt_outs,
  public.push_subscriptions,
  public.push_system_config,
  public.security_incidents,
  public.tag,
  public.user_consents,
  public.user_feature_overrides,
  public.user_tour_progress
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.admin_messages,
  public.admin_settings,
  public.auth_login_attempts,
  public.auto_update_runs,
  public.companies,
  public.coupon,
  public.coupon_active_viewers,
  public.coupon_alerts,
  public.coupon_merchant_search_cache,
  public.coupon_places,
  public.coupon_sales,
  public.coupon_shares,
  public.coupon_tags,
  public.coupon_transaction,
  public.coupon_usage,
  public.coupon_usage_imports,
  public.feature_access,
  public.gpt_usage,
  public.instinct_api_keys,
  public.ip_geo,
  public.newsletter_sendings,
  public.newsletters,
  public.notification_events,
  public.notification_preferences,
  public.notifications,
  public.opt_outs,
  public.push_subscriptions,
  public.push_system_config,
  public.referral_applications,
  public.referral_campaigns,
  public.referral_codes,
  public.referral_rewards,
  public.referrals,
  public.security_incidents,
  public.tag,
  public.user_activities,
  public.user_consents,
  public.user_feature_overrides,
  public.user_tour_progress,
  public.users
TO service_role;

GRANT INSERT, UPDATE, DELETE ON TABLE
  public.coupon,
  public.users
TO authenticated;

GRANT SELECT ON TABLE
  public.coupon_alerts,
  public.coupon_places,
  public.coupon_sales,
  public.referral_campaigns,
  public.referral_codes,
  public.referral_rewards,
  public.referrals,
  public.user_activities
TO authenticated;

GRANT SELECT ON TABLE
  public.coupon_sales
TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.ip_geo,
  public.security_incidents
TO anon;

GRANT SELECT, UPDATE, DELETE ON TABLE
  public.referral_applications
TO anon;

GRANT SELECT, UPDATE, DELETE ON TABLE
  public.referral_applications
TO authenticated;
