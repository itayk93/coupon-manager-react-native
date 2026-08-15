# יישום הפיצ'רים החדשים — סיכום

**תאריך:** 2026-07-08
מיושמים כל הפיצ'רים שהתבקשו, פרט לאלה שב-`EXCLUDED_FEATURES.md`.

## צד לקוח (React) — מוכן לשימוש מיידי

| פיצ'ר | קבצים עיקריים |
|-------|----------------|
| **תגיות** — CRUD, סינון ברשימה, ניהול באדמין | `hooks/useTags.ts`, `components/coupons/TagsInput.tsx`, `components/admin/AdminTags.tsx` |
| **היסטוריית ניצול** — timeline בפירוט קופון | `hooks/useCouponUsage.ts`, `components/coupons/CouponDetailExtras.tsx` |
| **מעקב צופים בזמן אמת** — Supabase Realtime | `hooks/useActiveViewers.ts` (מוצג ב-`CouponDetailExtras`) |
| **ייבוא בכמות (CSV)** — תצוגה מקדימה + ולידציה | `lib/bulkImport.ts`, `components/coupons/BulkImport.tsx` |
| **GDPR / הסכמות** — ביטול דיוור + מחיקת נתונים | `hooks/useConsent.ts`, לשונית "פרטיות" ב-`pages/settings/Settings.tsx` |
| **לוגואים אוטומטיים** — פותר מודע-DB + fallback | `lib/companyLogos.ts` (`resolveCompanyLogo`) |
| **פאנל אדמין מלא** — משתמשים/חברות/תגיות/משימות/ניוזלטרים/הודעות | `hooks/useAdminManagement.ts`, `components/admin/*`, `pages/admin/AdminDashboard.tsx` |
| **עמודי FAQ + פרטיות** | `pages/content/Faq.tsx`, `pages/content/Privacy.tsx` (ניתוב ב-`App.tsx`, קישורים ב-`Footer.tsx`) |
| **קישורי hooks ל-AI/עדכון/דוא"ל** | `hooks/useCouponAI.ts`, `hooks/useAutoUpdate.ts`, `hooks/useEmail.ts` |

## צד שרת (Supabase Edge Functions) — דורש פריסה
ראה `supabase/DEPLOYMENT.md` להוראות מלאות (סודות, פריסה, cron).

| פיצ'ר | function | שירות חיצוני |
|-------|----------|---------------|
| **פענוח קופון ב-AI** (טקסט/תמונה) | `parse-coupon` | Claude API (`ANTHROPIC_API_KEY`), מודל `claude-opus-4-8` |
| **מערכת דוא"ל** (ניוזלטר/תזכורות/בדיקה) | `send-emails` | Brevo (`BREVO_API_KEY`) |
| **עדכון יתרה אוטומטי** (אורקסטרטור) | `update-balance` | שירות סקרייפר חיצוני (`SCRAPER_SERVICE_URL`) |
| **משימות מתוזמנות / cron + Realtime + אילוצים** | `migrations/0001_features.sql` | pg_cron + pg_net |

### הערה על עדכון יתרה אוטומטי
הסקרייפרים המקוריים (headless browser + captcha) לא ניתנים להרצה בתוך Edge Function.
`update-balance` הוא **אורקסטרטור** שקורא לשירות סקרייפר חיצוני; ללא הגדרת
`SCRAPER_SERVICE_URL` קופונים מסומנים כ"דולגו" (מתועד ב-`auto_update_runs`), לא נכשלים בשקט.

## אימות
- `npm run build` ✅ עובר.
- עמודי FAQ ופרטיות נטענים ב-דפדפן ללא שגיאות console; אקורדיון עובד.
- שאר הפיצ'רים עוקבים אחר דפוסי ה-hooks הקיימים (React Query + supabase + הצפנת Fernet).
