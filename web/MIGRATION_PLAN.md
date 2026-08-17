# 🔄 Migration Plan: Coupon Master — Flask → Vite + React + TypeScript + Supabase

המרת הפרויקט `coupon_manager_project` (Flask/Python/Jinja2) לסטאק מודרני ב-`coupon_manager_project_new`.

> [!IMPORTANT]
> **הוחרגו מהמיגרציה:**
> - כל הפיצ'רים של מכירה/קניית קופונים (Marketplace, Transactions)
> - Telegram Bot (לא מומר)
>
> **החלטות עיצוב:**
> 1. שימוש ב-Supabase project הקיים (`dugjsiyenazpsoiyduuz`)
> 2. שימוש ב-Supabase Edge Functions למיילים
> 3. שימוש באותה הצפנת Fernet לקופונים ולכל השדות
> 4. חיבור ל-Database הקיים ללא שינויים

---

## 📊 סיכום הפרויקט המקורי

| רכיב | טכנולוגיה מקורית | טכנולוגיה חדשה |
|------|-------------------|----------------|
| Backend Framework | Flask 3.0.3 + Jinja2 | Vite + React 18 + TypeScript |
| Database | PostgreSQL via SQLAlchemy | Supabase (Same PostgreSQL DB) |
| Auth | Flask-Login + Google OAuth2 | Supabase Auth + Google OAuth |
| CSS | Bootstrap 4 + Custom CSS | Tailwind CSS + shadcn/ui + Radix UI |
| JS | Vanilla JS + jQuery | React + TypeScript |
| Icons | Font Awesome | Lucide React |
| Charts | Plotly.js | Recharts |
| Animations | CSS transitions | Framer Motion |
| Forms | Flask-WTF + WTForms | React Hook Form + Zod |
| State Management | Server-side sessions | TanStack React Query |
| Routing | Flask Blueprints | React Router DOM |
| Email | Sendinblue API | Supabase Edge Functions + Sendinblue |
| File Upload | Flask file handling | Supabase Storage |
| Encryption | Fernet (Python) | Fernet (JS implementation) |

---

## 🗃️ סכמת מסד הנתונים (חיבור ל-DB קיים)

> [!NOTE]
> לא משנים את ה-DB — מתחברים ישירות לאותו PostgreSQL של Supabase.
> כל המודלים מומרים ל-TypeScript types שמתאימים בדיוק לטבלאות הקיימות.

### מודלים שנכלול:

| מודל | קובץ לקרוא | תיאור |
|------|------------|--------|
| `User` | models.py L198-358 | משתמשים — Supabase Auth + profiles |
| `Coupon` | models.py L374-534 | קופונים — הטבלה המרכזית |
| `CouponUsage` | models.py L537-553 | שימושים בקופונים |
| `Tag` | models.py L360-371 | תגיות לקופונים |
| `coupon_tags` | models.py L178-195 | טבלת many-to-many |
| `Notification` | models.py L555-573 | התראות |
| `Company` | models.py L650-662 | חברות + לוגו |
| `CouponTransaction` | models.py L738-786 | לוג שימוש multipass |
| `CouponRequest` | models.py L630-647 | בקשות קופונים |
| `CouponShares` | models.py L1123-1151 | שיתוף קופונים |
| `AdminMessage` | models.py L941-948 | הודעות מנהל |
| `AdminSettings` | models.py L1174-1242 | הגדרות מערכת |
| `FeatureAccess` | models.py L951-954 | גישה לפיצ'רים |
| `UserTourProgress` | models.py L957-969 | מעקב סיור |
| `Newsletter` | models.py L1063-1095 | ניוזלטרים |
| `NewsletterSending` | models.py L1098-1120 | שליחות ניוזלטרים |
| `GptUsage` | models.py L789-813 | שימוש GPT |
| `UserConsent` | models.py L816-832 | הסכמות |
| `UserActivity` | models.py L835-858 | פעילות משתמשים |
| `OptOut` | models.py L861-872 | ביטול הסכמה |
| `ScheduledTask` + `TaskExecutionLog` | models.py L1245-1406 | משימות מתוזמנות |
| `AutoUpdateRun` | models.py L1413-1426 | עדכונים אוטומטיים |

---

## 🏗️ תוכנית מימוש מפורטת — 10 שלבים

---

### 🔹 שלב 1: אתחול הפרויקט + תשתית בסיסית

**מה לקרוא מהמקור:**
- package.json מ-challangex — כהתייחסות לסטאק הרצוי
- vite.config.ts מ-challangex — קונפיגורציית Vite
- tailwind.config.ts מ-challangex — קונפיגורציית Tailwind
- tsconfig.json מ-challangex — TypeScript config
- index.css מ-challangex — global styles / CSS variables
- app/config.py — להבין env vars נדרשים

**פעולות:**
1. אתחול פרויקט Vite + React + TypeScript ב-`coupon_manager_project_new`
2. התקנת כל ה-dependencies
3. קונפיגורציית Tailwind (RTL support, Hebrew fonts, theme colors)
4. הגדרת shadcn/ui components.json
5. יצירת קובץ `.env` עם Supabase URL ו-keys
6. מבנה תיקיות ראשוני

**תוצר:** פרויקט ריק שעולה עם `npm run dev`

---

### 🔹 שלב 2: סכמת TypeScript Types + Supabase Client

**מה לקרוא מהמקור:**
- app/models.py — כל הקובץ (1426 שורות) — לכל המודלים
- app/extensions.py — הגדרות DB
- .supabase.local.env — connection string

**פעולות:**
1. יצירת TypeScript types שמתאימים בדיוק לטבלאות הקיימות
2. יצירת Supabase client
3. יצירת Fernet encryption/decryption utilities ב-TypeScript
4. בדיקת חיבור ל-DB הקיים

**תוצר:** types מלאים + חיבור לDB

---

### 🔹 שלב 3: מערכת אימות (Auth)

**מה לקרוא מהמקור:**
- app/routes/auth_routes.py
- app/templates/login.html, register.html, forgot_password.html, reset_password_form.html
- app/forms.py
- app/registration_guard.py
- app/extensions.py

**פעולות:**
1. Auth context + hook (useAuth)
2. עמוד Login + Google OAuth
3. עמוד Register עם Zod validation
4. Forgot Password flow
5. Protected routes
6. Admin role detection

**תוצר:** מערכת auth מלאה

---

### 🔹 שלב 4: Layout + Navigation + תשתית UI

**מה לקרוא מהמקור:**
- app/templates/base.html
- app/templates/base_landing.html
- app/static/styles.css
- app/templates/landing_page.html

**פעולות:**
1. AppLayout component
2. Navbar + sidebar
3. React Router routes
4. Theme Provider
5. Landing Page
6. Mobile responsive
7. RTL configuration

**תוצר:** שלד האפליקציה

---

### 🔹 שלב 5: ניהול קופונים — הליבה

**מה לקרוא מהמקור:**
- app/routes/coupons_routes.py (265KB)
- app/routes/coupons_api_routes.py
- app/templates/index.html, coupons.html, coupon_detail.html
- app/templates/add_coupon.html, add_coupons.html, edit_coupon.html
- app/templates/index_modals/
- app/forms.py
- app/helpers.py
- app/utils/company_translator.py, logo_fetcher.py

**פעולות:**
1. Dashboard Page
2. Coupons List Page
3. Coupon Detail Page
4. Add Coupon (single + bulk + Excel)
5. Edit Coupon
6. Delete Coupon
7. Update Usage
8. Fernet encryption for coupon codes/URLs/CVV
9. Supabase CRUD services
10. React Query hooks

**תוצר:** מערכת ניהול קופונים מלאה

---

### 🔹 שלב 6: פרופיל משתמש + הגדרות

**מה לקרוא מהמקור:**
- app/routes/profile_routes.py (52KB)
- app/templates/profile/
- app/templates/notifications.html

**פעולות:**
1. Profile Page
2. Edit Profile
3. Change Password
4. User Preferences
5. Notifications Page

**תוצר:** ניהול פרופיל מלא

---

### 🔹 שלב 7: סטטיסטיקות + ייצוא

**מה לקרוא מהמקור:**
- app/routes/statistics_routes.py
- app/templates/statistics.html
- app/templates/index_modals/stats_modal.html, usage_report_modal.html
- app/routes/export_routes.py

**פעולות:**
1. Statistics Page עם Recharts
2. Usage Report
3. Export to PDF/Excel

**תוצר:** סטטיסטיקות + ייצוא

---

### 🔹 שלב 8: שיתוף קופונים + בקשות

**מה לקרוא מהמקור:**
- app/routes/sharing_routes.py
- app/routes/requests_routes.py
- app/routes/uploads_routes.py
- app/templates/share_*, upload_coupons.html, review_usage*

**פעולות:**
1. Share Coupon Flow
2. Request Coupon
3. Upload Coupons from Excel
4. Review Usage

**תוצר:** שיתוף, בקשות, העלאות

---

### 🔹 שלב 9: פאנל ניהול (Admin)

**מה לקרוא מהמקור:**
- app/routes/admin_routes/ (all files)
- app/templates/admin/ (21 templates)

**פעולות:**
1. Admin Dashboard
2. User Management
3. Company Management
4. Tag Management
5. Messages
6. Newsletter System
7. Scheduled Emails (Supabase Edge Functions)
8. Scheduler

**תוצר:** פאנל ניהול מלא

---

### 🔹 שלב 10: עמודי תוכן + API + שיפורים

**מה לקרוא מהמקור:**
- app/templates/about.html, faq.html, privacy_policy.html
- app/routes/api_routes.py
- app/routes/usage_data_routes.py
- app/email_helpers.py

**פעולות:**
1. About, FAQ, Privacy Policy pages
2. Error pages (403, 404)
3. Supabase Edge Functions for server-side operations
4. PWA support
5. SEO optimization

**תוצר:** אפליקציה מלאה ומוכנה
