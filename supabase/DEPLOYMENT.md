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
```

## 4. תזמון (Cron)
ראה את הבלוק המוער בסוף `migrations/0001_features.sql` ואת
[`0006_schedule_hourly_multipass_update.sql`](/Users/itaykarkason/Python%20Projects/coupon_manager_project_new/supabase/migrations/0006_schedule_hourly_multipass_update.sql).
פעולות מומלצות:
- `send-emails` עם `{"mode":"expiration_reminders"}` — פעם ביום.
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
