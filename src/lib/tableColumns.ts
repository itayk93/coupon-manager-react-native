// Explicit Supabase columns for queries that previously used select('*').
// Keeping these as const string literals preserves supabase-js row typing.

export const COMPANIES_COLUMNS = 'id,name,image_path,company_count' as const;

export const NEWSLETTERS_COLUMNS = 'id,created_at,created_by,title,newsletter_type,is_published,is_sent,sent_count,bundle_path,web_url,email_subject,hero_image_url,preview_text' as const;

export const ADMIN_MESSAGES_COLUMNS = 'id,created_at,message_text,link_url,link_text' as const;

export const TAG_COLUMNS = 'id,name,count' as const;

export const COUPON_USAGE_COLUMNS = 'id,coupon_id,used_amount,action,details,timestamp,place_name,place_address,latitude,longitude' as const;

export const COUPON_TRANSACTION_COLUMNS = 'id,coupon_id,usage_amount,recharge_amount,transaction_date,source,location,reference_number' as const;

export const OPT_OUTS_COLUMNS = 'user_id,opted_out,timestamp' as const;

export const NOTIFICATIONS_COLUMNS = 'id,user_id,type,title,message,link,shown,viewed,hide_from_view,timestamp' as const;

export const NOTIFICATION_PREFERENCES_COLUMNS = 'user_id,email,push,in_app,windows,quiet_until,timezone,daily_within,type_channels' as const;

export const USER_COLUMNS = 'id,public_id,email,first_name,last_name,gender,is_confirmed,is_admin,slots,slots_automatic_coupons,created_at,profile_description,profile_image,is_deleted,google_id,newsletter_subscription,telegram_monthly_summary,allow_widget_access,push_token,auth_user_id' as const;

