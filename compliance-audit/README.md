# סיכום בדיקת תאימות App Store & Google Play

הבדיקה הורצה באמצעות כלי ה-Playbook מתוך [mjmirza/app-store-compliance](https://github.com/mjmirza/app-store-compliance).

---

## קובצי לוג בתיקייה זו

1. **`01_guard_audit.log`** — תוצאות הסריקה הראשית מול חוקי הדחייה של Apple ו-Google.
2. **`02_accessibility_audit.log`** — סריקת נגישות (VoiceOver, ניגודיות, Dynamic Type, גודל אלמנטים).
3. **`03_regulatory_deadlines.log`** — בדיקת עמידה בחוקים ודרישות רגולטוריות עדכניות ל-2025–2026.
4. **`04_apple_requirements_monitor.log`** — ניתוח מסלולי דרישות מפתחים של Apple והשפעתם על הפרויקט.

---

## ממצאים עיקריים שחוסמים הגשה (Critical / High)

| נושא | חומרה | סיבה | קובץ יעד לתיקון |
|---|---|---|---|
| **Google Background Location** | `CRITICAL` | קיימת הרשאת `ACCESS_BACKGROUND_LOCATION` ללא מסך גילוי נאות מקדים (Prominent Disclosure) או Core Feature מוכח. | `app.json`, `AndroidManifest.xml` |
| **Sign in with Apple** | `HIGH` | קיים Google Sign-In ללא Sign in with Apple (הפרת סעיף 4.8 של Apple). | `package.json`, מסכי כניסה |
| **הצהרת הצפנה (Export Compliance)** | `HIGH` | חסר מפתח `ITSAppUsesNonExemptEncryption: false`. | `app.json` (תחת `ios.infoPlist`) |
| **הצהרות פרטיות (Privacy Manifest)** | `HIGH` | `NSPrivacyCollectedDataTypes` ריק למרות איסוף נתונים (זיהוי, נתוני משתמש). | `ios/CouponMaster/PrivacyInfo.xcprivacy` |
| **גיבוי Android לא מאובטח** | `HIGH` | חסרה הגדרת `android:allowBackup="false"` או חוקי `dataExtractionRules`. | `AndroidManifest.xml` |

---

## מצב טיפול

**כל הממצאים טופלו.** ראו [`REMEDIATION-2026-09-05.md`](./REMEDIATION-2026-09-05.md) לתיעוד מלא: מה שונה בקוד, מה התברר ככבר ממומש (Sign in with Apple, מחיקת חשבון, ביטול מנוי), ומה נותר — רק פעולות ידניות מול App Store Connect / Google Play Console / Supabase, המרוכזות בסעיף 11 של [`docs/APP_STORE_LAUNCH_CHECKLIST.md`](../docs/APP_STORE_LAUNCH_CHECKLIST.md).
