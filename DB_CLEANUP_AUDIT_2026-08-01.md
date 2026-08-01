# DB Cleanup Audit — 2026-08-01

מטרת המסמך:
- למפות אילו טבלאות ועמודות נראות מועמדות למחיקה
- להסביר למה
- להבדיל בין "לא בשימוש בקוד הזה" לבין "בטוח למחוק"

## מתודולוגיה

הבדיקה התבססה על:
- חיפוש שימושים אמיתיים בקוד `src/` וב־`supabase/functions/`
- ספירות rows מהמסד המרוחק
- בדיקת foreign keys מול ה־DB האמיתי

חשוב:
- ה־schema המקומי ב־`src/integrations/supabase/types.ts` אינו מלא.
- ב־DB האמיתי קיימות גם טבלאות נוספות כמו `transactions`, `user_ratings`, `user_reviews`.
- לכן "לא בשימוש בקוד הזה" לא מספיק לבד כדי למחוק. צריך גם לבדוק אם יש תלות חיצונית או מערכת אחרת.

## מצב הטבלאות בפועל

### טבלאות עם שימוש ברור בקוד

לא למחוק:

- `users`
- `coupon`
- `tag`
- `coupon_tags`
- `coupon_usage`
- `notifications`
- `push_system_config`
- `push_subscriptions`
- `companies`
- `coupon_transaction`
- `coupon_shares`
- `admin_messages`
- `admin_settings`
- `feature_access`
- `user_tour_progress`
- `newsletters`
- `newsletter_sendings`
- `gpt_usage`
- `user_consents`
- `opt_outs`
- `auto_update_runs`
- `coupon_active_viewers`

סיבה:
- נמצאו שימושים אמיתיים ב־UI, ב־hooks או ב־Edge Functions.

### טבלאות בלי שימוש אפליקטיבי בקוד הנוכחי

מועמדות לבדיקה למחיקה:

- `coupon_requests`
- `telegram_users`
- `user_activities`
- `scheduled_tasks`
- `task_execution_logs`

אבל לא כולן באותה רמת ביטחון.

## ספירות rows

נכון ל־2026-08-01:

- `users`: 135
- `coupon`: 428
- `tag`: 28
- `coupon_tags`: 323
- `coupon_usage`: 572
- `notifications`: 50
- `push_system_config`: 0
- `push_subscriptions`: 0
- `companies`: 74
- `coupon_transaction`: 635
- `coupon_requests`: 0
- `coupon_shares`: 7
- `admin_messages`: 1
- `admin_settings`: 12
- `feature_access`: 2
- `user_tour_progress`: 72
- `newsletters`: 3
- `newsletter_sendings`: 179
- `gpt_usage`: 476
- `user_consents`: 128
- `user_activities`: 30123
- `opt_outs`: 0
- `scheduled_tasks`: 0
- `task_execution_logs`: 0
- `auto_update_runs`: 661
- `coupon_active_viewers`: 0
- `telegram_users`: 8
- `user_feature_overrides`: 0

## ממצאים מרכזיים

### 1. `coupon_requests`

סטטוס:
- אין שימוש בקוד
- יש FK ל־`users`
- row count: `0`

המלצה:
- מועמד חזק למחיקה

למה:
- אין שימוש אפליקטיבי
- אין נתונים
- נראה שריד של flow בקשות/marketplace שלא קיים בפרויקט הזה

רמת ביטחון:
- גבוהה

### 2. `telegram_users`

סטטוס:
- אין שימוש בקוד
- יש FK ל־`users`
- row count: `8`

המלצה:
- לא למחוק מיד
- קודם לבדוק אם יש בוט טלגרם פעיל מחוץ לריפו הזה

למה:
- אין שימוש בקוד הנוכחי
- אבל יש נתונים אמיתיים
- טבלה קטנה עם 8 רשומות לרוב מצביעה על אינטגרציה חיצונית או legacy sync

רמת ביטחון:
- בינונית

### 3. `user_activities`

סטטוס:
- אין שימוש בקוד הנוכחי
- יש FK ל־`users`
- row count: `30123`

המלצה:
- לא למחוק כרגע
- רק אם מחליטים לוותר סופית על audit trail / activity log

למה:
- אין שימוש front/backend בתוך הריפו הזה
- אבל יש המון נתונים
- טבלה גדולה עם היסטוריה כמעט אף פעם לא מוחקים בלי החלטה מוצרית מפורשת

רמת ביטחון:
- נמוכה למחיקה
- גבוהה כטבלת legacy לא פעילה באפליקציה

### 4. `scheduled_tasks`

סטטוס:
- יש שימוש UI ב־admin
- row count: `0`

המלצה:
- לא למחוק

למה:
- למרות שהיא ריקה, הקוד כן משתמש בה
- היא חלק ממסך הניהול

רמת ביטחון:
- אסור למחוק כרגע

### 5. `task_execution_logs`

סטטוס:
- יש read מה־admin
- row count: `0`

המלצה:
- לא למחוק כרגע

למה:
- הקוד הניהולי משתמש בה
- אפשר לשקול להסיר feature של logs ואז למחוק

רמת ביטחון:
- אסור למחוק כרגע

### 6. `push_system_config`

סטטוס:
- row count: `0`
- בשימוש ב־`supabase/functions/_shared/push.ts`

המלצה:
- לא למחוק

למה:
- זו טבלת קונפיגורציה שנבנית lazily
- ריק כרגע לא אומר מיותר

### 7. `push_subscriptions`

סטטוס:
- row count: `0`
- בשימוש אמיתי ב־push flows

המלצה:
- לא למחוק

### 8. `user_feature_overrides`

סטטוס:
- row count: `0`
- בשימוש אמיתי בקוד החדש

המלצה:
- לא למחוק

למה:
- טבלה חדשה
- ריקה כי עוד לא השתמשו ב־feature overrides

## עמודות חשודות ב־`users`

להלן עמודות שלא מצאתי להן שימוש ישיר בקוד הנוכחי:

- `google_id`
- `dismissed_message_id`
- `slots_automatic_coupons`
- `dismissed_expiring_alert_at`
- `show_whatsapp_banner`

### `google_id`

המלצה:
- לא למחוק לפני בדיקה של auth/data migration

למה:
- גם אם אין Google login פעיל ב־UI, ייתכן שזו שארית חשובה ל־legacy users

### `dismissed_message_id`

המלצה:
- מועמד טוב למחיקה

למה:
- לא נמצא שימוש
- לא קשור ל־flows הנוכחיים

רמת ביטחון:
- בינונית-גבוהה

### `slots_automatic_coupons`

המלצה:
- מועמד למחיקה אם אין מוצר slot-based automation

למה:
- לא נמצא שימוש בקוד
- נשמע כמו שדה מוצר legacy

רמת ביטחון:
- בינונית

### `dismissed_expiring_alert_at`

המלצה:
- מועמד למחיקה

למה:
- לא נמצא שימוש

רמת ביטחון:
- בינונית-גבוהה

### `show_whatsapp_banner`

המלצה:
- מועמד למחיקה

למה:
- לא נמצא שימוש
- נשמע כמו feature שיווקי ישן

רמת ביטחון:
- בינונית-גבוהה

## עמודות חשודות ב־`coupon`

עמודות שלא מצאתי להן שימוש ישיר משמעותי:

- `strauss_coupon_url`
- `xtra_coupon_url`
- `exclude_saving`
- `notification_sent_pagh_tokev`
- `notification_sent_nutzel`

### `strauss_coupon_url`

המלצה:
- מועמד למחיקה אם אין integration route עתידי ל־Strauss

למה:
- מופיע רק בטייפים/decrypt
- אין flow אמיתי שמשתמש בזה

### `xtra_coupon_url`

המלצה:
- מועמד למחיקה אם אין integration route עתידי ל־Xtra

### `exclude_saving`

המלצה:
- מועמד למחיקה

למה:
- לא נמצא שימוש

### `notification_sent_pagh_tokev`

המלצה:
- מועמד למחיקה

למה:
- לא נמצא flow שמשתמש בו
- ייתכן שארית ישנה ממערכת התראות קודמת

### `notification_sent_nutzel`

המלצה:
- מועמד למחיקה

למה:
- לא נמצא שימוש

## עמודות שלא כדאי לגעת בהן

ב־`users`:
- `age`
- `gender`
- `profile_description`
- `profile_image`
- `newsletter_subscription`
- `telegram_monthly_summary`
- `pwa_prompt_dismissed`
- `pwa_installed`

ב־`coupon`:
- `is_available`
- `is_for_sale`
- `purpose`
- `auto_download_details`
- `reminder_sent_30_days`
- `reminder_sent_7_days`
- `reminder_sent_1_day`
- `last_detail_view`
- `last_company_view`
- `last_code_view`
- `last_scraped`
- `xgiftcard_coupon_url`

## ממצא חשוב: schema אמיתי רחב יותר מהריפו

ב־FK של ה־DB האמיתי נמצאו גם טבלאות:

- `transactions`
- `user_ratings`
- `user_reviews`

המשמעות:
- הריפו הזה לא מייצג את כל ה־DB
- אסור לבצע cleanup אגרסיבי רק לפי הקוד המקומי

## רשימת המלצות מסודרת

### מחיקה אפשרית מיידית יחסית

1. `coupon_requests`
2. `users.dismissed_message_id`
3. `users.dismissed_expiring_alert_at`
4. `users.show_whatsapp_banner`
5. `coupon.exclude_saving`
6. `coupon.notification_sent_pagh_tokev`
7. `coupon.notification_sent_nutzel`

### מחיקה רק אחרי אישור מוצר/legacy

1. `telegram_users`
2. `users.google_id`
3. `users.slots_automatic_coupons`
4. `coupon.strauss_coupon_url`
5. `coupon.xtra_coupon_url`

### לא למחוק כרגע

1. `user_activities`
2. `scheduled_tasks`
3. `task_execution_logs`
4. `push_system_config`
5. `push_subscriptions`
6. `user_feature_overrides`
7. `gpt_usage`
8. `newsletter_sendings`

## סדר עבודה מומלץ

1. לגבות schema + data
2. למחוק קודם רק מועמדים עם:
   - `0` rows
   - אין שימוש בקוד
   - אין תלות מוצרית ידועה
3. אחר כך למחוק עמודות legacy ב־`users`/`coupon`
4. רק בסוף לגעת בטבלאות עם נתונים קיימים

## הצעד הבא הנכון

אם רוצים cleanup בטוח באמת:

1. להריץ export schema מלא של ה־DB
2. למפות גם tables שלא קיימות בריפו (`transactions`, `user_ratings`, `user_reviews`)
3. להכין migration מדורגת:
   - שלב A: drop בטוח
   - שלב B: drop אחרי אישור מוצר
   - שלב C: archive לפני drop
