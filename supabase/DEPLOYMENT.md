# פריסת ה-Backend (Supabase) לפיצ'רים החדשים

מסמך זה מסביר איך לפרוס את ה-Edge Functions, את מיגרציות ה-DB, ואת ה-cron jobs
שמפעילים את הפיצ'רים: **פענוח קופון ב-AI**, **עדכון יתרה אוטומטי**, **Multipass/XGiftCard דרך Supabase**, ו**מערכת דוא"ל**.

## דרישות מקדימות
- Supabase CLI מותקן (`npm i -g supabase`)
- מקושר לפרויקט: `supabase link --project-ref <PROJECT_REF>`

## 1. מיגרציית מסד הנתונים
```bash
supabase db push
```
זה מוסיף אילוצי `unique` (נדרשים ל-upsert של opt-out וצופים בזמן אמת), מפעיל Realtime על
`coupon_active_viewers`, ומזריע את טבלת `scheduled_tasks`. פתח גם את Database → Extensions
והפעל את `pg_cron` ו-`pg_net`.

## 2. סודות (Secrets)
```bash
# פענוח AI (חובה לפיצ'ר ה-AI)
supabase secrets set OPENAI_API_KEY=sk-...

# דוא"ל (חובה למערכת הדוא"ל) — Brevo
supabase secrets set BREVO_API_KEY=...
supabase secrets set BREVO_SENDER_EMAIL=hello@itaykarkason.com
supabase secrets set BREVO_SENDER_NAME="Coupon Master"

# עדכון יתרה אוטומטי (אופציונלי — רק אם יש שירות סקרייפר חיצוני)
supabase secrets set SCRAPER_SERVICE_URL=https://your-scraper.example.com
supabase secrets set SCRAPER_SERVICE_TOKEN=...

# הפניות (Referral) — מלח לטביעת האצבע של ההתקנה.
# בלי הסוד הזה ה-install id פשוט לא נשמר: עדיף לוותר על הסימון של
# "כמה חשבונות מאותה התקנה" מאשר לשמור hash לא מומלח, שכל מי שמחזיק
# בטבלה יכול להתאים בחזרה למכשיר.
supabase secrets set REFERRAL_INSTALL_PEPPER=$(openssl rand -hex 32)

# Multipass / XGiftCard דרך GitHub Actions + Supabase Edge Function
supabase secrets set GITHUB_TOKEN=...
supabase secrets set MULTIPASS_GH_OWNER=itayk93
supabase secrets set MULTIPASS_GH_REPO=scrape_multipass
supabase secrets set MULTIPASS_GH_WORKFLOW=scrape.yml
supabase secrets set MULTIPASS_GH_REF=main
supabase secrets set MULTIPASS_GH_INPUT_KEY=card_number
supabase secrets set MULTIPASS_GH_INPUT_SEPARATOR=,
```
`SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` מוזרקים אוטומטית לכל function.

## 3. פריסת ה-Functions
```bash
supabase functions deploy parse-coupon
supabase functions deploy update-balance
supabase functions deploy trigger-multipass-update
supabase functions deploy manage-unsubscribe
supabase functions deploy send-emails
supabase functions deploy push-notifications
supabase functions deploy send-expiry-alerts
supabase functions deploy claim-referral
```

## 4. תזמון (Cron)
תזכורות התפוגה עברו ל-`send-expiry-alerts`, שרצה **כל שעה**:

- `migrations/0020_expiry_alerts_preferences.sql` יוצר את
  `public.trigger_send_expiry_alerts()` ורושם אותה ב-`pg_cron` על `0 * * * *`.
  כל שעה ולא פעם ביום, כי `quiet_until` של המשתמש אומר "לא לפני השעה הזו" —
  בהרצה יומית מי שהשעה שלו טרם הגיעה היה מדולג לתמיד. ה-ledger
  (`coupon_alerts`) נקרא לפני כל שליחה, אז ההרצות הנוספות לא שולחות פעמיים.

- `pg_cron` לא יכול להציג JWT, ומפתח ה-service role לא נשמר ב-Vault בכוונה.
  במקום זה יש טוקן ייעודי שמתיר דבר אחד: להתחיל הרצה. שני החצאים חייבים להתאים —

```sql
-- ב-Vault (פעם אחת לכל סביבה):
select vault.create_secret('https://<ref>.functions.supabase.co/send-expiry-alerts', 'send_expiry_alerts_function_url');
select vault.create_secret('<token אקראי>', 'send_expiry_alerts_cron_token');
```

```bash
# כסוד של ה-Function, עם אותו ערך בדיוק:
supabase secrets set EXPIRY_CRON_TOKEN=<אותו token>
```

- `send-expiry-alerts` הוא `verify_jwt = false` — הוא חייב להיות, כי הקריאה
  מ-`pg_cron` נושאת רק את ה-header. מי שאין לו את הטוקן חייב לעבור
  `requireAdmin()` או להיות ה-service role.

- `SSRF_ALLOWED_HOSTS` חייב לכלול `api.brevo.com` ו-`exp.host`, אחרת `safeFetch`
  נכשל סגור ולא יֵצאו מיילים ולא Push. הרשימה הנוכחית:
  `api.brevo.com,exp.host,api.openai.com,api.github.com,openidconnect.googleapis.com`.

- בדיקה ידנית של המסלול המלא:

```sql
select public.trigger_send_expiry_alerts();
select status_code, content from net._http_response order by id desc limit 1;
```

- **הפניות (Referral)** — `referral-progress-hourly` רץ על `17 * * * *` ומריץ
  את `public.refresh_referral_progress()` **ישירות**, בלי `pg_net` ובלי סוד
  ב-Vault. אין כאן קפיצת HTTP כי אין מה לקרוא בחוץ: החישוב הוא שאילתות מעל
  `coupon` ו-`user_activities` באותו מסד. לכן גם אין טוקן cron לתחזק.

```sql
-- הרצה ידנית (או מכפתור הרענון בטאב "הפניות" בפאנל הניהול):
select public.refresh_referral_progress();
```

  ה-job idempotent: `activated_at` ו-`retained_at` נכתבים פעם אחת ולא נדרסים,
  והכרעה אנושית על `fraud_status` (כלומר שורה עם `reviewed_at`) לא נדרסת גם היא.

בנוסף:
- ניקוי `coupon_active_viewers` ישנים — פעם בשעה.
- `trigger-multipass-update` — פעם בשעה דרך `pg_cron` + `vault`.

---

## ארכיטקטורת auto-update
- `BuyMe` נשאר דרך `SCRAPER_SERVICE_URL` חיצוני.
- `Multipass` ו-`XGiftCard` רצים דרך Supabase בלבד:
  `update-balance` → `trigger-multipass-update` → GitHub Actions `scrape_multipass`.
- cron של Supabase יכול להזניק `trigger-multipass-update` ישירות, בלי תלות באפליקציה.
- אין קריאה ישירה מתוך ה-frontend ל-`scrape_multipass`.

## בדיקה מהירה
- **AI:** בטופס הוספת קופון, הדבק טקסט קופון ולחץ "פענח ומלא".
- **דוא"ל:** פאנל ניהול → הודעות ודוא"ל → "מייל בדיקה".
- **תזכורות:** אותו מסך → "תזכורות תפוגה → הפעל עכשיו".
- **הפניות:** פאנל ניהול → הפניות. הטאב גלוי לאדמין בלבד, וזו לא רק הסתרה:
  כל טבלאות ה-referral חסומות ב-RLS מאחורי `is_app_admin()`, כך שמשתמש רגיל
  מקבל אפס שורות מ-Postgres. בדיקה מלאה מקצה לקצה מול הפרודקשן:
  `npm run e2e:referral` (יוצר חשבונות זמניים ומוחק אחריו הכול).

## נספח: תיקון היסטוריית מיגרציות (2026-08-29)

חלק מהמיגרציות הורצו בעבר ישירות מול הפרויקט המרוחק (Dashboard/MCP) ולא דרך
`supabase db push`. התוצאה הייתה טבלת היסטוריה עם 21 רשומות שלא היו קיימות
מקומית, ו-`db push` שסירב לרוץ.

התיקון: `supabase migration repair --status reverted` על הרשומות הכפולות,
`--status applied` על הקבצים המקומיים שתוכנם כבר קיים ב-DB, ואז `db push` על
שלוש המיגרציות שבאמת חסרו. `migration repair` נוגע רק ברישום — הוא לא מריץ ולא
מבטל SQL.

מסקנה תפעולית: כל שינוי סכימה עובר דרך קובץ ב-`supabase/migrations` ודרך
`db push`. הרצה ידנית ב-Dashboard יוצרת את הפער הזה מחדש.

מיגרציות צריכות להיות ניתנות להרצה חוזרת: `create table if not exists`,
`create or replace function`, ו-`drop policy if exists` לפני `create policy`.
