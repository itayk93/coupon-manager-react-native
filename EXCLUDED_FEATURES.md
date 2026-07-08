# פיצ'רים שלא מועתקים לפרויקט החדש

**תאריך החלטה:** 2026-07-08
**הקשר:** מיגרציה מ-`coupon_manager_project` (Flask) ל-`coupon_manager_project_new` (React+Supabase).

הפיצ'רים הבאים קיימים בפרויקט המקורי אך **הוחלט במפורש לא להעביר אותם** לפרויקט החדש.
אין להציע אותם שוב או לתכנן סביבם.

---

## 1. מרקטפלייס — קנייה/מכירה/בקשות של קופונים בין משתמשים ❌
הפיצ'ר הכי גדול במקור (~1,780 שורות).
- **מקור:** `marketplace_routes.py`, `requests_routes.py`
- **Endpoints:** `/marketplace`, `/buy_coupon`, `/sell_coupon`, `/offer_coupon`, `/request_coupon`, `/buy_slots`
- **טבלאות:** `Transaction`, `CouponRequest`, `CouponTransaction`
- **סיבה:** מחוץ לסקופ של הפרויקט החדש.

## 2. מחזור-חיים של עסקאות ❌
זרימות קונה↔מוכר: אישור / דחייה / ביטול / השלמה של עסקה, והעברת קוד הקופון לאחר תשלום.
- **מקור:** `transactions_routes.py` (~940 שורות)
- **Endpoints:** `/approve_transaction`, `/confirm_transaction`, `/decline_transaction`,
  `/cancel_transaction`, `/complete_transaction`, `/seller_cancel_transaction`
- **טבלה:** `CouponTransaction`, `UserRating`, `UserReview`
- **סיבה:** תלוי במרקטפלייס — מחוץ לסקופ.

## 3. באנר וואטסאפ (שיתוף עם קבוצת הוואטסאפ) ❌
באנר קידום המקושר לקבוצת וואטסאפ חיצונית.
- **מקור:** `admin_routes/admin_whatsapp_banner_routes.py`
- **Endpoints:** `/whatsapp-banner`, `/whatsapp-banner/bulk-update`, `/whatsapp-banner/users`
- **סיבה:** שיתוף פעולה חיצוני שאינו רלוונטי עוד.

---

**כל שאר הפיצ'רים מהמקור — כן מיושמים בפרויקט החדש** (ראה `FEATURE_GAP_ANALYSIS.md`
ו-`NEW_FEATURES_IMPLEMENTATION.md`).
