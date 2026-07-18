# פריסת ה-Backend (Supabase) לפיצ'רים החדשים

מסמך זה מסביר איך לפרוס את שלושת ה-Edge Functions, את מיגרציית ה-DB, ואת התזמון (cron)
שמפעילים את הפיצ'רים: **פענוח קופון ב-AI**, **עדכון יתרה אוטומטי**, ו**מערכת דוא"ל**.

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
# פענוח AI (חובה לפיצ'ר ה-AI) — OpenAI gpt-4o-mini
supabase secrets set OPENAI_API_KEY=sk-...

# דוא"ל (חובה למערכת הדוא"ל) — Brevo
supabase secrets set BREVO_API_KEY=...
supabase secrets set BREVO_SENDER_EMAIL=hello@itaykarkason.com
supabase secrets set BREVO_SENDER_NAME="Coupon Master"

# עדכון יתרה אוטומטי (אופציונלי — רק אם יש שירות סקרייפר חיצוני)
supabase secrets set SCRAPER_SERVICE_URL=https://your-scraper.example.com
supabase secrets set SCRAPER_SERVICE_TOKEN=...
```
`SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` מוזרקים אוטומטית לכל function.

## 3. פריסת ה-Functions
```bash
supabase functions deploy parse-coupon
supabase functions deploy update-balance
supabase functions deploy send-emails
```

## 4. תזמון (Cron)
ראה את הבלוק המוער בסוף `migrations/0001_features.sql` — הרץ את פקודות `cron.schedule`
אחרי החלפת `<PROJECT_REF>` ו-`<SERVICE_KEY>`. פעולות מומלצות:
- `send-emails` עם `{"mode":"expiration_reminders"}` — פעם ביום.
- ניקוי `coupon_active_viewers` ישנים — פעם בשעה.

---

## הערה חשובה על "עדכון יתרה אוטומטי"
הסקרייפרים המקוריים (`scrape_buyme`, `scrape_multipass`) הם פרויקטי Node/Python כבדים עם
דפדפן headless ופתרון-captcha — **לא ניתן להריץ אותם בתוך Edge Function של Deno**.

הארכיטקטורה כאן:
- `update-balance` הוא **אורקסטרטור**: הוא בוחר את הקופונים לעדכון, קורא לשירות סקרייפר
  חיצוני (`SCRAPER_SERVICE_URL`) לכל קופון, מחיל את היתרה שחוזרת, ומתעד ב-`auto_update_runs`.
- כדי להפעיל בפועל: יש לפרוס את הסקרייפרים הקיימים כ**מיקרו-שירות HTTP** שחושף
  `POST /scrape/{provider}` ומחזיר `{ "remaining": <number> }`, ולהצביע אליו עם `SCRAPER_SERVICE_URL`.
- ללא הגדרת `SCRAPER_SERVICE_URL`, כל הקופונים מסומנים כ"דולגו" (ולא נכשלים בשקט).

## בדיקה מהירה
- **AI:** בטופס הוספת קופון, הדבק טקסט קופון ולחץ "פענח ומלא".
- **דוא"ל:** פאנל ניהול → הודעות ודוא"ל → "מייל בדיקה".
- **תזכורות:** אותו מסך → "תזכורות תפוגה → הפעל עכשיו".
