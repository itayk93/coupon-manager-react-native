import { Database } from './types';

export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type Coupon = Database['public']['Tables']['coupon']['Row'];
export type CouponInsert = Database['public']['Tables']['coupon']['Insert'];
export type CouponUpdate = Database['public']['Tables']['coupon']['Update'];

export type CouponUsage = Database['public']['Tables']['coupon_usage']['Row'];
export type Company = Database['public']['Tables']['companies']['Row'];
export type Tag = Database['public']['Tables']['tag']['Row'];
export type CouponTag = Database['public']['Tables']['coupon_tags']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type CouponTransaction = Database['public']['Tables']['coupon_transaction']['Row'];
export type CouponShare = Database['public']['Tables']['coupon_shares']['Row'];
export type AdminMessage = Database['public']['Tables']['admin_messages']['Row'];
export type AdminSettings = Database['public']['Tables']['admin_settings']['Row'];
export type FeatureAccess = Database['public']['Tables']['feature_access']['Row'];
export type UserTourProgress = Database['public']['Tables']['user_tour_progress']['Row'];
export type Newsletter = Database['public']['Tables']['newsletters']['Row'];
export type NewsletterSending = Database['public']['Tables']['newsletter_sendings']['Row'];
export type GptUsage = Database['public']['Tables']['gpt_usage']['Row'];
export type UserConsent = Database['public']['Tables']['user_consents']['Row'];
export type UserActivity = Database['public']['Tables']['user_activities']['Row'];
export type OptOut = Database['public']['Tables']['opt_outs']['Row'];
export type ScheduledTask = Database['public']['Tables']['scheduled_tasks']['Row'];
export type TaskExecutionLog = Database['public']['Tables']['task_execution_logs']['Row'];
export type AutoUpdateRun = Database['public']['Tables']['auto_update_runs']['Row'];
export type CouponActiveViewer = Database['public']['Tables']['coupon_active_viewers']['Row'];
export type TelegramUser = Database['public']['Tables']['telegram_users']['Row'];
