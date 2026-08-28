/**
 * Every column of public.users except `password`.
 *
 * The hash is withheld at the grant level (migration 0013), so `select('*')`
 * on this table now fails outright with "permission denied for table users" —
 * column-level privileges do not answer a star. Selecting this list instead of
 * '*' is the supported way to read the table from a client.
 *
 * Keep in sync when adding a column to users. Never add `password`.
 */
/*
 * Declared as a single literal (not `[...].join(',')`): supabase-js needs the
 * literal type to resolve the row shape of a `.select()`. A `string` makes the
 * query resolve to an error type instead of the row.
 */
// prettier-ignore
export const USER_COLUMNS = 'id,public_id,email,first_name,last_name,age,gender,region,is_confirmed,is_admin,slots,slots_automatic_coupons,created_at,profile_description,profile_image,coupons_sold_count,is_deleted,google_id,newsletter_subscription,telegram_monthly_summary,newsletter_image,allow_widget_access,push_token,auth_user_id' as const;
