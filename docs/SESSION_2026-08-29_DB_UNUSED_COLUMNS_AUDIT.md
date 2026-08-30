# ביקורת עמודות DB לא בשימוש — 2026-08-29

תיעוד מלא של סשן שבו מיפינו את כל עמודות ה-DB, הצלבנו מול הקוד, וסימנו מה
אפשר למחוק בבטחה. כולל הצעדים, ההחלטות, ה-trade-offs, מה בוצע, ומה נשאר לשלבים הבאים.

---

## 1. מטרה

לענות על שאלה אחת: **אילו עמודות, באילו טבלאות, אפשר למחוק כי אף אחד לא צריך
אותן.**

הבהרה שהתקבלה תוך כדי הסשן: לא מעניין מה התוכנה הישנה (Flask web app + בוט
טלגרם) עושה. השאלה מצומצמת ל**מה שהאפליקציה הזו (RN) וה-edge functions
צריכים**. עמודה שרק הבאקאנד הישן כותב — נחשבת מועמדת למחיקה.

---

## 2. סביבה

| דבר | ערך |
|---|---|
| פרויקט Supabase | `MaCoupon` / `dugjsiyenazpsoiyduuz` (us-east-1, PG 15) |
| ריפו | `coupon-manager-react-native` — client RN + `supabase/functions` + `scripts` |
| מקורות אמת לשימוש | `src/`, `supabase/functions/`, פונקציות DB (RPC), views, triggers, pg_cron |
| טבלאות | 37 base tables + 2 views |

---

## 3. שיטה — צעד אחר צעד

### שלב א׳ — שליפת הסכימה המלאה

```sql
select table_name, string_agg(column_name, ', ' order by ordinal_position)
from information_schema.columns
where table_schema='public' group by table_name;
```

תוצאה: ~37 טבלאות, מאות עמודות. נשמרה כרשימת `(table, [columns])`.

### שלב ב׳ — סריקת קוד (ניסיון ראשון, נכשל)

ניסינו `grep` בלולאת shell על כל עמודה. **שני באגים:**

1. `grep -e "\`$tbl\`"` — הבקטיק בתוך `"..."` ב-zsh הפעיל command substitution.
   כל שורת ה-grep קרסה → הכול חזר 0 → "הכול לא בשימוש". שקר.
2. תיקון עם `['\"]` בתוך regex — zsh פירש כ-math expression. קרס שוב.

**לקח:** לא לולאות grep מורכבות ב-zsh. לעבור ל-Python.

### שלב ג׳ — סריקת קוד ב-Python

בנינו blob מכל `.ts/.tsx/.js/.jsx/.mjs` תחת `src` + `supabase/functions`,
בלי `types.ts` (הוא מכיל כל עמודה ולכן מזהם). לכל עמודה בדקנו דפוסי שימוש:
`'col'`, `"col"`, `.col`, `col:`.

תוצאה ראשונית: רשימת "לא מוזכר בקוד" לכל טבלה.

### שלב ד׳ — הצלבה מול צד ה-DB (הקריטי)

עמודה שלא מופיעה בקוד עדיין יכולה להיות בשימוש ע"י:

- **RPC** שהאפליקציה קוראת (`supabase.rpc(...)`)
- **View**
- **Trigger function**
- **pg_cron job**

בדקנו את כולם:

```sql
-- טריגרים
select event_object_table, trigger_name, action_statement
from information_schema.triggers where trigger_schema='public';

-- כל פונקציה שמזכירה עמודה חשודה
select p.proname, ... from pg_proc p ... where pg_get_functiondef(p.oid) ~* '\ycol\y';

-- views
select viewname, definition from pg_views where schemaname='public';

-- cron
select jobname, schedule, command from cron.job;
```

**זה שינה את התמונה.** הרבה עמודות ש"לא בקוד" התגלו כמחוברות ל-RPC/trigger/view
שהאפליקציה כן משתמשת בהם.

### שלב ה׳ — הצלבה מול דאטה בפועל

```sql
select count(col), count(*) from <table>;   -- לכל עמודה חשודה
```

עמודה שהיא NULL/0 ב-100% מהשורות = חיזוק שהיא מתה. עמודה עם דאטה = זהירות
(מישהו מילא אותה פעם, גם אם לא הקוד הנוכחי).

### שלב ו׳ — סיווג ל-4 טירים

לפי שילוב: אזכור בקוד × אזכור בצד DB × דאטה בפועל.

---

## 4. הסיווג המלא

### טיר 1 — מחיקה בטוחה (בוצע)

אף אזכור ב-src, edge, פונקציית DB, view, trigger, cron. רובן גם ריקות בדאטה.

| טבלה | עמודות | נימוק |
|---|---|---|
| `newsletters` | `telegram_bot_section`, `website_features_section`, `additional_title`, `greeting_title`, `greeting_content`, `highlight_text`, `highlight_icon`, `footer_message`, `scheduled_send_time` | שדות תצוגה מה-newsletter builder הישן של הווב. NULL ב-100%. |
| `gpt_usage` | `id`, `object`, `cost_usd`, `cost_ils`, `exchange_rate`, `prompt_text` | ה-edge (`parse-coupon`, `parse-usage-screenshot`) כותב רק `user_id, created, model, *_tokens, response_text`. עמודות ה-cost מלאות בשורות ישנות מהווב. |
| `coupon_shares` | `revocation_token`, `revocation_token_expires_at`, `revocation_requested_by`, `revocation_requested_at` | flow של "קישור ביטול במייל" שלא נבנה. ה-flow שכן רץ = RPC `respond_to_coupon_share` + עמודת `revoked_at` (שתיהן נשארו). |
| `admin_settings` | `setting_type` | `setting_value` נקרא כ-text. רמז הטיפוס לא בשימוש. |
| `newsletter_sendings` | `error_message` | `send-emails` כותב רק `delivery_status`. |
| `user_activities` | `geo_location`, `isp`, `zip`, `lon`, `org`, `as_info` | העשרת geo-IP מה-logger הישן. `log-activity` (edge) כותב רק `ip_address, device, country_code, extra_metadata`. |
| `users` | `coupons_sold_count` (תמיד 0), `newsletter_image` (תמיד NULL), `age` (2/131, לא נקרא), `region` (תמיד NULL) | שדות פרופיל/שיווק מתים. |

**סה"כ: 31 עמודות ב-7 טבלאות.**

### טיר 2 — חצי-מתות (לא בוצע)

האפליקציה **קוראת** אותן למסך אדמין, אבל שום דבר כבר לא **כותב** (רק הווב הישן כתב).
מחיקה מחייבת גם למחוק את קוד התצוגה.

- `user_activities`: `city`, `region`, `lat`, `timezone` — מוצגות במסך פעילות אדמין,
  מלאות רק בשורות היסטוריות. (`country_code` נשארת — `log-activity` כן כותב אותה.)
- `users.telegram_monthly_summary` — הבוט קורא/כותב, לא האפליקציה הזו.

### טיר 3 — נראות מתות, אסור לגעת (לא בוצע)

מחוברות לפונקציות DB שהאפליקציה קוראת. מחיקה תשבור RPC/trigger/view חי.

| עמודה / טבלה | מי מחזיק |
|---|---|
| `users.google_id` | trigger `handle_auth_user_created` + `guard_users_self_update` |
| `users.slots`, `slots_automatic_coupons` | `guard_users_self_update` (הגנת אנטי-הסלמה). מחיקה דורשת קודם עריכת הפונקציה. |
| `coupon_shares.accepted_at` | RPC `respond_to_coupon_share` |
| `coupon_usage_imports` (כל הטבלה + `import_key`, `usage_count`, `total_amount`) | RPC `record_coupon_usage_batch` שהאפליקציה קוראת. 0 שורות כרגע אבל חי. |
| כל `referrals.*`, `referral_campaigns.starts_at/ends_at`, `referral_rewards.paid_by`, `referral_applications.reviewed_by` | RPCs של referral + 2 views (`referral_admin_rows`, `referral_campaign_overview`) + cron `refresh_referral_progress` |

### טיר 4 — טבלאות שלמות של הווב/בוט (לא בוצע)

האפליקציה + edge לא נוגעות. **אבל** — התגלה מאוחר שיש בכל זאת מסכי אדמין
ב-RN שקוראים חלק מהן דרך `src/lib/tableColumns.ts` (ראה סעיף 6). לא נגענו.

- `scheduled_tasks` (0 שורות), `task_execution_logs` (0), `auto_update_runs` (665 — לוג סקרייפר)
- `telegram_users` + כל עמודות ה-verification — הבוט מחזיק. האפליקציה רק מייבאת TS type אחד.

---

## 5. Trade-offs

| החלטה | בעד | נגד | מה בחרנו |
|---|---|---|---|
| להריץ דרך Supabase MCP במקום `supabase db push` | ה-CLI מחזיר `403` (role מוגבל, אין `SUPABASE_DB_PASSWORD`). ה-MCP עובד. | ה-MCP רושם migration עם timestamp משלו — צריך ליישר ידנית את שם הקובץ המקומי. | MCP. שיניתי את שם הקובץ המקומי ל-`20260829202018_...` כדי שיתאים ל-version ברמוט. |
| למחוק עמודות עם דאטה (`user_activities` geo ~15k שורות, `gpt_usage` cost 459) | הן NULL/מיותרות קדימה. המשתמש אישר במפורש פעמיים. | איבוד דאטה היסטורית בלתי הפיך. | למחוק. תועד שהדאטה תאבד. |
| רגנרציה מלאה של `types.ts` מול הסרה כירורגית | רגנרציה = "נקי", מסונכרן מלא. | הגנרטור הנוכחי (`supabase gen types` v2.84) מייצר טיפוסי פרמטרים ל-RPC בצורה אחרת מהקובץ ה-committed → 6 שגיאות TS לא קשורות ב-`useCouponUsage.ts` (`string \| undefined` מול `string \| null`). | הסרה כירורגית — מחקנו רק את 93 השורות של 31 העמודות (Row/Insert/Update × 31). בלי drift לא קשור. |
| טיר 1 בלבד מול טיר 1+2 | טיר 2 גם "מתות". | טיר 2 דורש לגעת בקוד תצוגה של אדמין — סיכון רגרסיה גבוה יותר, מעבר ל-scope. | טיר 1 בלבד. |

---

## 6. טעות בדרך + תיקון

הסריקה הראשונית (`src/` + `functions/`) **פספסה שני קבצים**:

- `src/lib/tableColumns.ts`
- `src/lib/userColumns.ts`

הם מחזיקים רשימות עמודות כמחרוזת אחת (`'id,age,gender,region,...'`) בתור
תחליף ל-`select('*')` ששומר על טייפינג. הסריקה חיפשה `'age'` / `.age` / `age:`
— לא ` age,` בתוך מחרוזת מופרדת בפסיקים.

**התוצאה:** `tsc` אחרי המחיקה נכשל —
`column 'age' does not exist on 'users'`,
`column 'additional_title' does not exist on 'newsletters'`.

**התיקון:** גזרנו את העמודות שנמחקו מ-3 הקונסטנטים:

```
USER_COLUMNS        — הסרת age, region, coupons_sold_count, newsletter_image
NEWSLETTERS_COLUMNS — הסרת 9 שדות התצוגה
ADMIN_SETTINGS_COLUMNS — הסרת setting_type
```

בדקנו שאין צרכן לשדות עצמם (לא `nl.footer_message` בשום מסך) —
`tsc` נקי מאשר. הקונסטנטים הם select של שורה שלמה בלי שימוש בשדה הבודד.

---

## 7. מה בוצע בפועל

1. **מיגרציה** `supabase/migrations/20260829202018_drop_unused_tier1_columns.sql` —
   `DROP COLUMN IF EXISTS` בתוך transaction אחד, 31 עמודות, עם הערות נימוק.
2. **הורצה על ה-DB** דרך MCP `apply_migration`. אומת בספירת עמודות
   (`users` 25→21, `newsletters` 22→13, `gpt_usage` 14→8 וכו').
3. **`src/integrations/supabase/types.ts`** — הוסרו 93 שורות (סקריפט Python שמזהה
   בלוק טבלה ומדלג על שורות עמודה תואמות ב-Row/Insert/Update).
4. **`src/lib/tableColumns.ts`, `src/lib/userColumns.ts`** — גזירת הקונסטנטים.
5. **אימות:** `tsc -p tsconfig.json --noEmit` נקי · `vitest run` 167/167 עוברים.
6. **קומיט** `784b63d0` ל-main, נדחף ל-origin.

---

## 8. Rollback (אם צריך)

הדאטה של העמודות שנמחקו — אבודה. שחזור הסכימה בלבד:

```sql
begin;
alter table public.users
  add column age integer,
  add column region varchar,
  add column coupons_sold_count integer default 0,
  add column newsletter_image text;
alter table public.newsletters
  add column telegram_bot_section text, add column website_features_section text,
  add column additional_title text, add column greeting_title text,
  add column greeting_content text, add column highlight_text text,
  add column highlight_icon text, add column footer_message text,
  add column scheduled_send_time timestamptz;
alter table public.gpt_usage
  add column id text, add column object text, add column cost_usd numeric,
  add column cost_ils numeric, add column exchange_rate numeric, add column prompt_text text;
alter table public.coupon_shares
  add column revocation_token text, add column revocation_token_expires_at timestamptz,
  add column revocation_requested_by integer, add column revocation_requested_at timestamptz;
alter table public.admin_settings add column setting_type varchar;
alter table public.newsletter_sendings add column error_message text;
alter table public.user_activities
  add column geo_location text, add column isp text, add column zip text,
  add column lon double precision, add column org text, add column as_info text;
commit;
```

(טיפוסים משוערים מה-snapshot; אמת מול `types.ts` ב-`git show 784b63d0^`.)

ואז `git revert 784b63d0` להחזרת הקונסטנטים והטיפוסים.

---

## 9. Phase 2 — מחיקת טבלאות מתות (בוצע 2026-08-30)

### הבהרה שסגרה את ה-scope

פרויקט `coupon_manager_project` (Python/Flask, נתיב מקומי
`/Users/itaykarkason/Python Projects/coupon_manager_project`) **ירד מהאוויר**.
אין ריפו שני. הריפו הזה (RN) הוא הצרכן היחיד של ה-DB — הוא זה שמשרת web + iOS +
android. אז "לסרוק את ריפו הווב" = לא רלוונטי, הביקורת שלמה.

### מי חי לפי תאריך כתיבה אחרון

| טבלה | כתיבה אחרונה | מסקנה |
|---|---|---|
| `user_activities` | 2026-08-30 | חי (edge `log-activity`) |
| `auto_update_runs` | 2026-08-29 (cron) | חי (`trigger_hourly_multipass_update`) |
| `gpt_usage` | 2026-08-27 | חי (edge parsing) |
| `telegram_users` | **2026-05-07**, 8 שורות | מת |
| `scheduled_tasks` | 0 שורות | מת |
| `task_execution_logs` | 0 שורות | מת |

תיקון להנחה מסעיף 4 (טיר 4): `auto_update_runs` + `gpt_usage` **אינן** "טבלאות
ווב ישן" — הן מונעות ע"י cron + edge של הריפו הזה. נשארות.

### מה נמחק

מיגרציה `20260830043150_drop_dead_python_tables`:

```sql
drop table if exists public.task_execution_logs;  -- FK -> scheduled_tasks, drop first
drop table if exists public.scheduled_tasks;
drop table if exists public.telegram_users;
```

תלות יחידה שנמצאה: FK `task_execution_logs_task_id_fkey`. אין function/cron/FK אחר.

קוד שנמחק (קומיט `16761728`):
- hooks מתים ב-`useAdminManagement.ts`: `useScheduledTasks`, `useTaskLogs`,
  `useToggleTask` — הוגדרו אך אף מסך לא ייבא אותם.
- קונסטנטים: `SCHEDULED_TASKS_COLUMNS`, `TASK_EXECUTION_LOGS_COLUMNS`.
- type exports: `ScheduledTask`, `TaskExecutionLog`, `TelegramUser`.
- 3 בלוקים ב-`types.ts` (171 שורות).

אימות: `tsc` נקי · `vitest` 167/167.

הערה: ב-`types.ts` נשאר בלוק פנטום `telegram_users_audit_log` — טבלה שלא קיימת
ב-DB, היה שם עוד לפני הסשן. לא נגעתי. שווה ניקוי בעתיד.

### תקלה תפעולית

`git add -A` בקומיט הראשון של Phase 2 סחף 18 קבצים לא קשורים ששונו במקביל
בעץ העבודה (עבודת פורמט מטבע — `formatIls`, `WalletHeroCard` וכו', לא של הסשן
הזה). בוטל עם `git reset --soft HEAD~1` לפני push. הקומיט הסופי מכיל רק 4 קבצים.
**לקח:** `git add <קבצים מפורשים>`, לא `-A`, כשעץ העבודה לא נקי.

---

## 10. Phase 3 — Geo analytics + שימור IP מבוקר (בוצע 2026-08-30)

טיר 2 השתנה מ"מחיקה" ל"פיצ'ר": `user_activities` הייתה write-only (0 קוראים),
אז במקום למחוק את שדות ה-geo — בנינו מנגנון שממלא אותם.

**Spec:** [superpowers/specs/2026-08-30-geo-analytics-and-ip-retention-design.md](superpowers/specs/2026-08-30-geo-analytics-and-ip-retention-design.md)
· **Plan:** [superpowers/plans/2026-08-30-geo-analytics-and-ip-retention.md](superpowers/plans/2026-08-30-geo-analytics-and-ip-retention.md)

### מה נבנה

| רכיב | פירוט |
|---|---|
| טבלה `ip_geo` | IP → city/region/isp/asn. keyed by value, RLS service-role בלבד, נגזמת ב-90 יום. Backfill מ-9 שורות Python היסטוריות. |
| edge `enrich-ip-geo` | cron 15 דק'. resolve דרך `ipwho.is` (או `ipinfo.io` אם `IPINFO_TOKEN` קיים). upsert ל-`ip_geo` + **צריבת `city`/`region` על שורות `user_activities`** כדי שהמיקום ישרוד את מחיקת ה-IP. |
| `strip_old_activity_ip()` | cron יומי 03:00. `ip_address` + `extra_metadata` → NULL אחרי 90 יום. `city`/`region`/`action` נשארים. מוחק `ip_geo` יתומים. |
| `reset_failed_ip_lookups()` | cron שבועי. מוחק lookups שנכשלו לפני >7 יום כדי לנסות שוב. |
| RPC `admin_geo_breakdown(30\|90)` | `is_app_admin()`-gated. GROUP BY region/city, בלי JOIN. |
| טאב אדמין "גאוגרפיה" | `GeoAnalyticsTab` + `useGeoAnalytics`. טבלה עם bar, בורר 30/90 יום. |
| `referral_fraud_reasons` | סיגנל `asn_burst` חדש — ≥8 מופנים באותו ASN תוך 24ש'. allowlist: Bezeq/Partner/Cellcom/HOT/012 (AS8551,AS12400,AS1680,AS16116,AS8867,AS9116,AS39737). סף 8 (מול 5 ל-`ip_burst`). |
| מדיניות פרטיות | `PrivacyScreen` §4 חדש (תיעוד פעילות, שימור IP 90 יום, geolocation צד ג'). ריכוך §2. |
| מחיקת חשבון | `useConsent` מוחק גם `user_activities` של המשתמש. |

### `user_activities` — 5 עמודות נמחקו

מ-16 ל-**11** עמודות. נמחקו: `duration` (תמיד 0), `browser` (RN לא כותב),
`country` (כפילות `country_code`), `lat` (אין `lon`, אין מפה), `timezone`.
נוסף index על `ip_address` (נדרש ל-self-join של ה-fraud בכל מקרה).

עמודות נוכחיות: `activity_id, user_id, action, coupon_id, timestamp, ip_address,
device, extra_metadata, city, region, country_code`.

### מיגרציות (14)

`20260830051806_create_ip_geo` · `..51811_backfill_ip_geo` ·
`..51851_user_activities_geo_cleanup` · `..52819_ip_geo_cron` ·
`..53447_referral_fraud_asn_burst` · `..53455_admin_geo_breakdown` ·
`..53951_referral_fraud_reasons_array_append_fix` · `..54129_lock_down_ip_geo_cron_functions` ·
`..55518_ip_geo_cron_token_rpc` · `..62042_newsletters_admin_rls` ·
`..63134_admin_geo_breakdown_text_cast`

(+ `types.ts`: הוסרו בלוקים פנטומיים `telegram_users_audit_log`, `transactions` —
טבלאות שלא קיימות ב-DB.)

### טאב "ניוזלטר" לאדמין

`NewslettersTab` — list/create/edit/delete של טיוטות ניוזלטר. **שליחה לא מחוברת**
(`useSendNewsletter` קיים ב-`useEmail.ts` אבל הקומפוננט לא מייבא אותו). `newsletters`
הייתה עם RLS דלוק ו-0 policies → נעילה מלאה; נוסף policy `is_app_admin()`
(`send-emails` לא מושפע, service-role).

### באגים שנתפסו תוך כדי

1. **IPs פרטיים היסטוריים** — ~48 מתוך 116 כתובות ה-IP הן `10.220.x` / `0.0.0.0`
   (infra של ה-Python הישן). מסומנות `lookup_failed`, לא מנוסות שוב. שורות
   RN-era (מ-2026-08 ואילך) עם IP ציבורי אמיתי — נפתרות תקין (ת"א, חיפה, ר"ג).
2. **`ip_geo_pending` retry loop** — הגרסה הראשונה החזירה גם IPs שנכשלו → נוסו
   כל run. תוקן: מחריג כל IP שכבר ב-cache; ה-reset השבועי מוחק כשלים ישנים.
3. **`reasons || 'literal'`** ב-`referral_fraud_reasons` — עמום ב-PG15
   (`array_append` מול `array_cat`), נכשל בפעם הראשונה שסיגנל נורה. באג רדום
   שהיה גם בסיגנלים המקוריים. תוקן ל-`|| array['x']` לכולם.
4. **RPCs חשופים** — `trigger_enrich_ip_geo`/`strip_old_activity_ip`/
   `reset_failed_ip_lookups` היו callable מ-`anon`/`authenticated` דרך PostgREST.
   `REVOKE`ד (מיגרציה `..54129`).
5. **`admin_geo_breakdown` varchar/text** — `user_activities.city/region` הן
   `varchar`, ה-`RETURNS TABLE` מכריז `text` → `coalesce` נשאר `varchar` →
   PostgREST דוחה `42804`. הטסט ב-SQL (שאילתה גולמית) לא תפס את זה; נתפס בהרצת
   האפליקציה. תוקן עם `::text` (מיגרציה `..63134`).

### E2E שאומת (live, דרך MCP)

- `enrich-ip-geo`: `87.68.5.22` → Tel-Aviv/Tel-Aviv District, `46.19.86.x` →
  Rishon LeZion/Pelephone AS16116. queue drained (pending=0).
- צריבה: `user_activities.city` עלה מ-16,203 ל-16,353+.
- `strip_old_activity_ip`: שורה בת 100 יום → `ip_address` NULL, `extra_metadata`
  NULL, `city='Testville'` נשמר.
- `admin_geo_breakdown(30)` כאדמין → Tel-Aviv 5 users/804 events; כ-`authenticated`
  → `FORBIDDEN`.
- `asn_burst`: 9 חשבונות על AS64999 → `['asn_burst']`; 9 על AS8551 (Bezeq) → `[]`.

### אימות טוקן בלי edge secret

ה-CLI וה-MCP לא יכולים להגדיר edge secrets בסביבה הזו (`403`, role מוגבל).
במקום זה `enrich-ip-geo` קורא את הטוקן הצפוי מה-Vault דרך RPC
`ip_geo_cron_token()` (`SECURITY DEFINER`, `service_role` בלבד) ומשווה ל-header
`x-cron-token`. הטוקן חי רק ב-Vault (`ip_geo_cron_token`), מיושם גם ב-cron.
אומת live: token נכון → 200, שגוי → 403. **אין צעד ידני.**

הטוקן תועד גם ב-`.env.supabase.local` המקומי (gitignored) בשם `IP_GEO_CRON_TOKEN`
עבור `scripts/e2e-geo.mjs`.

### `ipgeo-debug` — מנוטרל, לא נמחק

edge function שנוצר לדיבוג ה-provider תוך כדי המימוש. **אין tool ב-MCP למחיקת
edge functions, וה-CLI מחזיר `403`.** נטרלתי אותו במקום:
- `verify_jwt = true` → `401` בלי JWT תקין
- הגוף מחזיר `410 gone` בכל מקרה
- אומת: קריאה ללא auth → `401 UNAUTHORIZED_NO_AUTH_HEADER`

למחיקה פיזית: Dashboard → Edge Functions → `ipgeo-debug` → Delete.

### `IPINFO_TOKEN` — לא בוצע, לא נחוץ

דורש (א) פתיחת חשבון ב-ipinfo.io — פעולה אסורה לסוכן, (ב) הגדרת edge secret —
`403`. `ipwho.is` פותר כל IP ישראלי אמיתי נכון (ת"א, ראשל"צ, פ"ת, חיפה) עם
ISP + ASN. הקוד כבר מעדיף `ipinfo.io` אוטומטית אם ה-secret קיים; להוסיף בעתיד
זו הגדרת secret אחת, בלי שינוי קוד.

### הרצת אפליקציה (expo web, מחובר כאדמין)

- טאב **גאוגרפיה** — נרנדר, מציג פילוח אמיתי: Tel-Aviv 5 users/804 events, Yavne,
  Kiryat Ono, Ramat Gan, "לא ידוע". בורר 30/90 יום עובד. (תיקון באג #5 בדרך.)
- טאב **ניוזלטר** — נרנדר, מציג 3 טיוטות קיימות. מודל עריכה נפתח עם כל השדות
  מלאים. אין כפתור שליחה. RLS policy עובד (דאטה נטענת).

### State סופי — הכל חי ואוטומטי

- **cron:** `ip-geo-enrich` (`*/15`), `ip-geo-strip` (`0 3`), `ip-geo-reset-failed` (`0 4 * * 0`) — רשומים.
- **מסלול מלא אומת:** `select trigger_enrich_ip_geo()` → edge → vault token check → `200`.
- **`ip_geo`:** 68 IPs נפתרו (59 ipwho + 9 legacy), 48 פרטיים סומנו `lookup_failed`, pending=0.
- **`user_activities`:** 11 עמודות, `city` מלא ב-16,353+ שורות.
- `tsc` נקי · `vitest` 167/167 · `npm run size` 7.8MB / 4.2MB.

### Commits (Phase 3)

`85918d9` ip_geo table + backfill · `d3223da` drop 5 columns + index ·
`9c6d70a` enrich-ip-geo worker + shared resolver · `0ed72a1` cron + retention ·
`eef3522` admin tab + asn_burst + privacy · `e3b1656` e2e-geo + array_append fix ·
`1fd3aaa` revoke cron RPCs · `1a085b6` Phase 3 docs · `5f5c421` vault-token auth.

### תלות חדשה

`ipwho.is` — HTTPS, בלי key, fair-use. נקרא רק מ-edge (לא בבאנדל). fallback ל-`ipinfo.io`.

---

## 10.2 Phase 4 — ניוזלטר מהעלאת קובץ (בוצע 2026-08-30)

**Spec:** [superpowers/specs/2026-08-30-file-upload-newsletters-design.md](superpowers/specs/2026-08-30-file-upload-newsletters-design.md)
· **Plan:** [superpowers/plans/2026-08-30-file-upload-newsletters.md](superpowers/plans/2026-08-30-file-upload-newsletters.md)

במקום להדביק HTML לשדה `content`/`custom_html` — מעלים קובץ (ZIP מ-Claude Design
או `.html` בודד). מודל Substack: הקובץ מתארח כדף web מלא, המייל הוא teaser קבוע
שמקשר אליו.

### מה נבנה

| רכיב | פירוט |
|---|---|
| `newsletters` סכימה | −4 עמודות (`content`, `custom_html`, `main_title`, `image_path`), +5 (`bundle_path`, `web_url`, `email_subject`, `hero_image_url`, `preview_text`). 14 עמודות. |
| Storage bucket `newsletters` | public read, `service_role` write. |
| edge `newsletter-upload` | admin-gated. unzip (`jsr:@zip-js/zip-js`) → Storage → `node-html-parser` שולף `<title>`/`<img>`/`<p>` → שכתוב `src`/`href` יחסי → כותב את ה-pointers לשורה בלי לדרוס שדות שנערכו ידנית. |
| edge `newsletter-page` | **public.** מגיש כל קובץ בחבילה מה-Storage עם Content-Type אמיתי (Storage הציבורי כופה `text/plain` על html/css/js). זה ה-`web_url`. |
| `newsletterTeaserEmailHtml()` | ב-`_shared/emailTemplate.ts`. table-based, inline, RTL. שורת "צפייה בדפדפן" + hero + כותרת + פסקה + כפתור לדף. אין `<script>`. |
| `send-emails` / `newsletter-preview` | מרנדרים את ה-teaser (לא את הקובץ). דורשים `web_url`. |
| `NewslettersTab` | file picker (`expo-document-picker`) במקום שדות טקסט. אחרי העלאה — `email_subject`/`hero`/`preview_text` editable, לינק "צפייה בדף המלא". אין כפתור שליחה. |
| `newsletters_admin_rls` | הטבלה הייתה RLS-on / 0-policies (נעילה מלאה). policy `is_app_admin()`. |
| מחיקת ניוזלטר | `useDeleteNewsletter` מנקה גם את ה-Storage. |

### מיגרציות

`20260830072753_newsletters_file_upload_columns` · `..72758_newsletters_storage_bucket`
(+ `20260830062042_newsletters_admin_rls` מ-Phase 3.5).

### תלות חדשה

`expo-document-picker` `~57.0.1` — +10 שורות ב-lock, bundle נשאר 7.8MB. `jsr:@zip-js/zip-js`
+ `npm:node-html-parser` — edge בלבד, לא בבאנדל.

### באגים שנתפסו בהרצה

1. **Content-Type** — Storage הציבורי מגיש `.html` כ-`text/plain` (anti-phishing) →
   הדף הראה קוד מקור. נפתר עם `newsletter-page` שמגיש `text/html; charset=utf-8`.
2. **path parsing** ב-`newsletter-page` — pathname של edge fn כולל את שם הפונקציה;
   התיקון מדלג על segments עד ה-id המספרי.
3. **`send-emails` לא נפרס מחדש** — ה-CLI וה-MCP שניהם חסומים (הרשאות / גודל 8 קבצים).
   ה-index.ts המקומי עודכן; `mode: 'newsletter'` הישן לא מחובר ל-UI/cron אז ה-deploy
   הישן לא נגיש. **פתוח:** לפרוס `send-emails` דרך CLI/dashboard תקין.

### E2E שאומת (live)

- העלאת `.html` → `web_url` = `.../functions/v1/newsletter-page/<id>`, `email_subject`
  ו-`preview_text` נשלפו נכון.
- `curl web_url` → `HTTP 200`, `content-type: text/html; charset=utf-8`, `file` מזהה
  `HTML document, UTF-8` — עברית תקינה.
- `newsletter-preview` → teaser ל-`itayk93@gmail.com` **בלבד** (Brevo messageId אחד),
  לא נגע ב-`newsletter_sendings`, לא הפך `is_sent`.
- טאב אדמין: הניוזלטר עם קובץ מסומן "מוכן לשליחה", 3 הישנים "חסר קובץ עיצוב". מודל
  עריכה מציג file picker + שדות editable + "צפייה בדף המלא".
- advisors: 0 חדשים (ה-policy החדש דווקא הסיר את ה-`rls_enabled_no_policy` על `newsletters`).
- `tsc` נקי · `vitest` 167/167.
- תיקון צד: הוסר `...` מ-placeholder של חיפוש משתמשים באדמין (נראה שבור ב-RTL).

### צעד ידני שנשאר

- לפרוס `send-emails` מחדש (ראה באג #3) לפני שליחת ניוזלטר לכל הרשימה.

---

## 10.1 שלבים הבאים (לא בוצעו)

| שלב | פעולה | סיכון |
|---|---|---|
| deploy | לפרוס `send-emails` מחדש דרך CLI/dashboard תקין. | בינוני — bulk newsletter שבור עד אז. |
| טיר 3 | לא למחוק `users.slots/google_id` וכו' בלי לערוך קודם `guard_users_self_update`. | גבוה. |
| ניוזלטר-טלגרם | אם מת: `users.telegram_monthly_summary`, `newsletters.show_telegram_button/newsletter_type`. | החלטת מוצר. |
| `asn_burst` tuning | לכוונן את ה-allowlist מול נתוני `ip_geo` אמיתיים אחרי כמה שבועות. | נמוך. |
| ipgeo-debug | למחוק מה-dashboard (מנוטרל). | — |

---

## 11. אימות אחרי Phase 1 + 2 (2026-08-30)

| בדיקה | תוצאה |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | נקי, rc=0 |
| `npx vitest run` | 25 קבצים, 167/167 עוברים |
| `npm run size` — JS bundle | 7.8MB (תקציב ≤10MB; היה 8.1MB) |
| `npm run size` — assets | 4.2MB (תקציב ≤6MB) |
| Supabase security advisors | **0 התראות חדשות.** כל ה-WARN קיימים מראש (referral RPCs `SECURITY DEFINER`, `function_search_path_mutable`, leaked-password protection, גרסת PG). `rls_enabled_no_policy` על `coupon_usage_imports` — INFO, טיר 3, נשמרה בכוונה. |
| refs תלושים ל-טבלאות/עמודות שנמחקו ב-`src` + `supabase/functions` | אין |
| קבצי migration מקומיים מול remote | תואמים — `20260829202018`, `20260830043150` |
| עץ עבודה | נקי |

מסקנה: שתי המיגרציות בריאות. אין רגרסיה. שום view/function/trigger/cron לא נשבר.

---

## 12. שאילתות עזר לשימוש חוזר

```sql
-- כל העמודות לפי טבלה
select table_name, string_agg(column_name, ', ' order by ordinal_position)
from information_schema.columns where table_schema='public' group by table_name;

-- ספירת שורות (מיון לפי גודל)
select relname, n_live_tup from pg_stat_user_tables
where schemaname='public' order by n_live_tup;

-- base table מול view
select table_name, table_type from information_schema.tables
where table_schema='public';

-- פונקציה שמזכירה עמודה X
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and pg_get_functiondef(p.oid) ~* '\yX\y';

-- cron jobs
select jobname, schedule, command from cron.job;
```
