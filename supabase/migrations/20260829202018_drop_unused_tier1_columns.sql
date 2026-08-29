-- Drop columns that nothing touches: not in the RN app, not in edge functions,
-- not in any DB function/RPC, not in a view, trigger, or cron job.
-- Verified 2026-08-29. Legacy web-app writers are intentionally out of scope.
--
-- Kept deliberately (wired to RPCs/triggers the app calls): users.google_id,
-- users.slots, users.slots_automatic_coupons, coupon_shares.accepted_at,
-- coupon_shares.revoked_at, gpt_usage token/response columns.

begin;

-- newsletters: presentation fields from the old web newsletter builder.
-- All NULL in every row.
alter table public.newsletters
  drop column if exists telegram_bot_section,
  drop column if exists website_features_section,
  drop column if exists additional_title,
  drop column if exists greeting_title,
  drop column if exists greeting_content,
  drop column if exists highlight_text,
  drop column if exists highlight_icon,
  drop column if exists footer_message,
  drop column if exists scheduled_send_time;

-- gpt_usage: the edge functions log user_id, created, model, *_tokens and
-- response_text. These cost/id columns are never written or read here.
alter table public.gpt_usage
  drop column if exists id,
  drop column if exists object,
  drop column if exists cost_usd,
  drop column if exists cost_ils,
  drop column if exists exchange_rate,
  drop column if exists prompt_text;

-- coupon_shares: an email revoke-link flow that was never built.
-- respond_to_coupon_share + revoked_at cover the shipped revoke path.
alter table public.coupon_shares
  drop column if exists revocation_token,
  drop column if exists revocation_token_expires_at,
  drop column if exists revocation_requested_by,
  drop column if exists revocation_requested_at;

-- admin_settings: setting_value is read as text; the type hint is unused.
alter table public.admin_settings
  drop column if exists setting_type;

-- newsletter_sendings: send-emails only ever sets delivery_status.
alter table public.newsletter_sendings
  drop column if exists error_message;

-- user_activities: geo-enrichment columns from the old web logger.
-- log-activity writes only ip_address, device, country_code, extra_metadata.
alter table public.user_activities
  drop column if exists geo_location,
  drop column if exists isp,
  drop column if exists zip,
  drop column if exists lon,
  drop column if exists org,
  drop column if exists as_info;

-- users: dead profile/marketing fields.
alter table public.users
  drop column if exists coupons_sold_count,
  drop column if exists newsletter_image,
  drop column if exists age,
  drop column if exists region;

commit;
