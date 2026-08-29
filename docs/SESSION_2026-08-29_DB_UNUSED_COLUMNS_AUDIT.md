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

## 9. שלבים הבאים (לא בוצעו)

| שלב | פעולה | סיכון |
|---|---|---|
| טיר 2 | למחוק `user_activities.city/region/lat/timezone` + `users.telegram_monthly_summary`. קודם למחוק את קוד התצוגה במסך פעילות אדמין. | בינוני — רגרסיה במסך אדמין. |
| טיר 3 | לא למחוק בלי לערוך קודם את פונקציות ה-DB (`guard_users_self_update` וכו'). | גבוה — שבירת RPC/trigger חי. |
| טיר 4 | להחליט אם מסכי האדמין ב-RN ל-`scheduled_tasks`/`auto_update_runs`/`task_execution_logs` עדיין רלוונטיים. אם לא — למחוק מסך + קונסטנט + טבלה יחד. | גבוה — הווב הישן עדיין כותב לטבלאות האלה. |
| כללי | להריץ את אותה סריקה (סעיף 3) על ריפו הווב/Flask לפני כל מחיקה נוספת. | — |

---

## 10. שאילתות עזר לשימוש חוזר

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
