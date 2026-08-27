// Explicit Supabase columns for queries that previously used select('*').
// Keeping these as const string literals preserves supabase-js row typing.

export const COUPON_COLUMNS = 'id,user_id,company,code,description,value,cost,used_value,status,expiration,date_added,is_one_time,is_for_sale,purpose,cvv,card_exp,buyme_coupon_url,strauss_coupon_url,xgiftcard_coupon_url,xtra_coupon_url,auto_download_details,auto_update,last_scraped,last_detail_view,last_company_view,last_code_view,show_in_widget,widget_display_order,source' as const;

export const COMPANIES_COLUMNS = 'id,name,image_path,company_count' as const;

export const SCHEDULED_TASKS_COLUMNS = 'id,created_at,created_by_user_id,description,execution_time,is_active,last_run,next_run,schedule_type,schedule_value,task_name,task_type,timezone,updated_at' as const;

export const TASK_EXECUTION_LOGS_COLUMNS = 'id,task_id,status,executed_at,execution_time_seconds,result_message,error_message,additional_data' as const;

export const NEWSLETTERS_COLUMNS = 'id,created_at,created_by,title,content,main_title,additional_title,greeting_title,greeting_content,website_features_section,highlight_icon,highlight_text,telegram_bot_section,footer_message,custom_html,image_path,newsletter_type,scheduled_send_time,is_published,is_sent,sent_count,show_telegram_button' as const;

export const ADMIN_MESSAGES_COLUMNS = 'id,created_at,message_text,link_url,link_text' as const;

export const AUTO_UPDATE_RUNS_COLUMNS = 'id,user_id,run_type,triggered_by_user_id,status,started_at,finished_at,updated_count,failed_count,skipped_count,message,job_id' as const;

export const TAG_COLUMNS = 'id,name,count' as const;

export const COUPON_USAGE_COLUMNS = 'id,coupon_id,used_amount,action,details,timestamp,place_name,place_address,latitude,longitude' as const;

export const COUPON_TRANSACTION_COLUMNS = 'id,coupon_id,usage_amount,recharge_amount,transaction_date,source,location,reference_number' as const;

export const FEATURE_ACCESS_COLUMNS = 'id,feature_name,access_mode' as const;

export const USER_FEATURE_OVERRIDES_COLUMNS = 'id,user_id,feature_key,is_enabled,created_at,updated_at' as const;

export const ADMIN_SETTINGS_COLUMNS = 'id,setting_key,setting_type,setting_value,description,created_at,updated_at' as const;

export const OPT_OUTS_COLUMNS = 'user_id,opted_out,timestamp' as const;

export const NOTIFICATIONS_COLUMNS = 'id,user_id,type,title,message,link,shown,viewed,hide_from_view,timestamp' as const;

export const NOTIFICATION_PREFERENCES_COLUMNS = 'user_id,email,push,in_app,windows,quiet_until,timezone,daily_within,type_channels' as const;

export const COUPON_ALERTS_COLUMNS = 'id,coupon_id,user_id,window_days,channel,sent_at,status' as const;
