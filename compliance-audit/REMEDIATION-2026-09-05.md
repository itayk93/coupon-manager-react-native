# תיקון ממצאי תאימות — 2026-09-05

תיעוד מלא של טיפול בכל הממצאים מהסריקות בתיקייה זו (`01`–`04`). כל שינוי נעשה ישירות על `main`.

סיכום: **3 Critical תוקנו, 6 High טופלו (4 בקוד, 2 התבררו כממומשים), 14 Medium תוקנו, 2 דדליינים רגולטוריים לא רלוונטיים לאפליקציה.** בדיקות: `npm test` — 310 עברו, `npm run typecheck` — נקי.

---

## 1. Critical — תוקנו

### 1.1 GOOGLE-PERM-BACKGROUND-LOCATION — הרשאת מיקום ברקע ללא שימוש

**ממצא:** `ACCESS_BACKGROUND_LOCATION` מוצהרת ב-`app.json` וב-`AndroidManifest.xml`, אך אין בשום מקום בקוד קריאה ל-`requestBackgroundPermissionsAsync` או שימוש ב-geofencing. הרשאה מוצהרת ולא בשימוש = דחייה מובטחת ב-Google Play.

**פתרון:** הסרה מלאה. האפליקציה משתמשת במיקום רק בפורגראונד ("המיקום שלי" לרישום מקום שימוש בקופון).

- `app.json` — הסרת `android.permission.ACCESS_BACKGROUND_LOCATION` מ-`permissions`
- `app.json` — `expo-location`: `isAndroidBackgroundLocationEnabled: false`, `isIosBackgroundLocationEnabled: false`, מחיקת מחרוזות `locationAlwaysAndWhenInUsePermission` ו-`locationAlwaysPermission` (לא בשימוש)
- `android/app/src/main/AndroidManifest.xml` — הסרת שורת ההרשאה

> **אין צורך במסך Prominent Disclosure** כי ההרשאה כבר לא קיימת — הפתרון הנקי ביותר לדרישה של Google.

### 1.2 APPLE-PRIVACY-MANIFEST-MISSING / RN-PRIVACY-MANIFEST-MISSING — `NSPrivacyCollectedDataTypes` ריק

**ממצא:** `ios/CouponMaster/PrivacyInfo.xcprivacy` הכיל reason codes ל-APIs אבל `NSPrivacyCollectedDataTypes` היה מערך ריק למרות איסוף נתונים אמיתי.

**פתרון:** מילוי המערך בהתאמה למה שהאפליקציה באמת אוספת (הכול linked, אפס tracking, מטרה App Functionality):

| סוג נתון | מקור |
|---|---|
| `NSPrivacyCollectedDataTypeEmailAddress` | הרשמה/התחברות דרך Supabase Auth |
| `NSPrivacyCollectedDataTypeUserID` | מזהה המשתמש ב-Supabase |
| `NSPrivacyCollectedDataTypeOtherUserContent` | קופונים, תמונות שוברים, שיתופים |
| `NSPrivacyCollectedDataTypeCoarseLocation` | רישום מקום השימוש בקופון |

### 1.3 APPLE-2.1-STAGING-BACKEND — מחרוזת localhost ב-release bundle

**ממצא:** הסריקה מצאה מחרוזת `localhost` בקוד שנכלל ב-build הסופי.

**פתרון:** בדיקה העלתה שהמחרוזת היחידה הייתה בהודעת משתמש ב-`src/lib/pushNotifications.ts`: "Push דורש HTTPS או localhost." — לא כתובת backend, אך מפעילה את הדגל. שונתה ל-**"Push דורש חיבור מאובטח (HTTPS)."** כתובות ה-Supabase מגיעות ממשתני סביבה בלבד (`EXPO_PUBLIC_SUPABASE_URL`) — אין כתובת staging מקודדת.

---

## 2. High — תוקנו / אומתו

### 2.1 APPLE-4.8-SOCIAL-LOGIN-ONLY — Sign in with Apple ✅ כבר ממומש

בדיקה מלאה מפריכה את הממצא: `src/lib/socialAuth.ts` תומך ב-`apple` ו-`google` באופן זהה (`signInWithSocialProvider` + `linkSocialProvider`), ו-`src/screens/auth/LoginScreen.tsx` מציג את "המשך עם Apple" באותה רמת בולטות בדיוק כמו "המשך עם Google", בכל פלטפורמה. הסעיף התקבל כחיובי שקט של הסריקה הסטטית (טקסט עברי לא נסרק).

**נותר לוודא ידנית (App Store Connect / Supabase):** שספק Apple מופעל ב-Supabase Auth עם Services ID ו-Key נכונים.

### 2.2 APPLE-EXPORT-COMPLIANCE-MISSING — הצהרת הצפנה ✅

נוסף ל-`app.json` תחת `ios.infoPlist`:

```json
"ITSAppUsesNonExemptEncryption": false
```

האפליקציה משתמשת רק בהצפנה של HTTPS/מערכת — פטורה. ה-build לא ייתקע ב-"Missing Compliance".

### 2.3 ANDROID-INSECURE-BACKUP — גיבוי לא מאובטח ✅

- `android/app/src/main/AndroidManifest.xml`: `allowBackup="true"` → `allowBackup="false"`, בתוספת `android:dataExtractionRules="@xml/data_extraction_rules"` ו-`android:fullBackupContent="@xml/full_backup_content"`
- קבצי כללים חדשים `android/app/src/main/res/xml/data_extraction_rules.xml` ו-`full_backup_content.xml` — שוללים גיבוי של SharedPreferences ומסד הנתונים (שם יושבים tokens ונתוני משתמש)
- **`plugins/withAndroidBackupRules.js`** — config plugin חדש שמיישם את כל האמור גם אחרי `npx expo prebuild` עתידי (רשום ב-`app.json`)

### 2.4 BOTH-SECURE-STORAGE — credentials באחסון רגיל ✅

**ממצא:** טוקני ה-session של Supabase (שני JWTs ארוכי טווח) נשמרו ב-AsyncStorage.

**פתרון:**
- הותקן `expo-secure-store` (רשום ב-`app.config.ts`)
- נוצר `src/lib/secureSessionStorage.ts` — אדפטר אחסון ל-Supabase: Keychain ב-iOS / Keystore ב-Android, עם פיצול ל-chunks (מגבלת 2KB לערך) ו-**מיגרציה אוטומטית** של session קיים מ-AsyncStorage בקריאה הראשונה — אף משתמש לא יתנתק
- `src/integrations/supabase/client.ts` עבר להשתמש באדפטר (web ממשיך עם AsyncStorage — מתאים לדפדפן)

### 2.5 APPLE-ACCOUNT-DELETION-WEAK — מחיקת חשבון ✅ כבר ממומש

`src/hooks/useConsent.ts` → `useDeleteAccount` קורא ל-edge function `delete_account` שמוחק את כל הנתונים בכל הטבלאות + זהות ה-auth, ומיד מנתק. מוצג ב-`SettingsScreen` ("מחיקת החשבון") עם אישור כפול. מחיקה אמיתית, לא deactivate. אין שינוי קוד.

### 2.6 BOTH-SUBSCRIPTION-HARD-CANCEL — ביטול מנוי ✅ לא רלוונטי

אין באפליקציה מנוי בתשלום, IAP או StoreKit (נבדק: אין תלות billing ב-gradle, אין קוד רכישה). ה"מנוי" היחיד הוא דיוור חדשות, עם ביטול עצמאי מלא באפליקציה (`useSetOptOut`). חיובי שקט.

### 2.7 GOOGLE-DATASAFETY-MISMATCH / APPLE-PRIVACY-NUTRITION-LABELS — טפסים ידניים

אין SDK פרסומי/אנליטיקה באפליקציה (נבדק). ה-privacy manifest המלא (סעיף 1.2) הוא המקור למילוי הטפסים.

**נותר ידנית:** למלא ב-App Store Connect (App Privacy) וב-Google Play Console (Data Safety) לפי הטבלה בסעיף 1.2.

### 2.8 RN-OTA-UNDECLARED — גילוי OTA

Expo Updates פעיל. **נותר ידנית:** לציין בהערות App Review: "Updates are delivered via Expo Updates (expo-updates), restricted to bug fixes and performance improvements; no change to the app's purpose, features, or UI outside the review process."

### 2.9 GOOGLE-12-TESTER-RULE / APPLE-2.3-AGE-RATING-2026 — דרישות Console בלבד

ידניות: 12 בודקים / 14 יום ב-closed testing (חשבון אישי חדש ב-Google), ומענה על שאלון דירוג הגיל החדש ב-App Store Connect.

---

## 3. Medium — נגישות (14 ממצאים) — כולם תוקנו

### 3.1 APPLE-ACCESSIBILITY-COLORCONTRAST (8) — `targets/add-share/ShareViewController.swift` + `targets/share/ShareViewController.swift`

צבעי המותג ב-`Brand` הומרו מ-`UIColor(red:...)` קבועים ל-**dynamic provider** שמחליף גרסה בעלת ניגודיות מוגברת כש-"Increase Contrast" פעיל (`UIAccessibility.isDarkerSystemColorsEnabled`). נוסף helper `UIColor(rgb:)` (hex) כדי שהפלטה תישאר קריאה.

### 3.2 APPLE-ACCESSIBILITY-VOICEOVER (4) — שני קובצי ה-Share + וידג'ט

- שני קובצי `ShareViewController`: ה-mascot וה-badge הוגדרו כדקורטיביים (`isAccessibilityElement = false`); הכרטיס עצמו הפך לאלמנט VoiceOver יחיד, עם `announceState()` שמעדכן את ה-label ומכריז `.screenChanged` בכל מצב (התחלה, הצלחה, כישלון)
- `targets/widget/CouponWidget.swift`: `Image(uiImage:)` ב-`CompanyLogoView` וב-`AppLogoView` קיבלו `.accessibilityHidden(true)` (דקורטיביים)

### 3.3 APPLE-ACCESSIBILITY-DYNAMICTYPE (2) — `targets/widget/CouponWidget.swift`

`.font(.system(size: 10))` ו-`.system(size: 9)` הוחלפו ב-`.font(.caption2.weight(.bold))` — טקסט סיסטמי שמתאים את עצמו ל-Dynamic Type.

> הערה: סריקה סטטית עתידית עשויה עדיין לדגל את מספרי ה-hex ב-`Brand`, אך ההתנהגות עומדת בדרישה של Apple (תמיכה מלאה ב-Increase Contrast).

---

## 4. דדליינים רגולטוריים

| דדליין | סטטוס עבור האפליקציה |
|---|---|
| Play Billing Library 8 (31.8.2026) | **לא רלוונטי** — אין IAP/חיוב באפליקציה (אומת: אין תלות billing ב-gradle) |
| Target API 36 (31.8.2026) | **מאומת בקוד** — `node_modules/react-native/gradle/libs.versions.toml` מציב `compileSdk = 36` ו-`targetSdk = 36` (Expo 57 / RN 0.83). ה-build הבא עומד בדדליין |
| Android Developer Verification (30.9.2026) | ידני — רישום ואימות זהות מפתח ב-Google Play Console (נדרש בברזיל/אינדונזיה/סינגפור/תאילנד). רשום בצ'קליסט סעיף 11 |
| EU Cyber Resilience Act (11.9.2026) | **טופל** — מדיניות דיווח פגיעויות עם לוחות זמנים התואמים ל-CRA נוספה ל-`SECURITY.md` (ערוץ: GitHub private vulnerability reporting) |
| EU Data Act (12.9.2026) | access-by-design — הייצוא העצמי של הנתונים (`useExportAccount`) עונה על הדרישה לנתוני האפליקציה |

---

## 5. אימות

- `npm test` — **42 קבצים, 310 בדיקות, כולן עברו** (הורץ אחרי שני הסבבים)
- `npm run typecheck` (`tsc --noEmit -p tsconfig.native.json`) — **נקי**
- `app.json` תקין (JSON), `plugins/withAndroidBackupRules.js` נטען, `PrivacyInfo.xcprivacy` XML מאוזן
- `supabase/config.toml` — הבלוק החדש מוער במלואו, לא משפיע על `supabase start` עד שיופעל ידנית

## 6. סבב שני — טיפול בסעיפים הקונפיגורטיביים והתהליכיים

### 6.1 Sign in with Apple — תשתית Supabase

- `supabase/config.toml`: נוסף בלוק `[auth.external.apple]` מוער (client_id ו-secret מופנים למשתני סביבה) עם הוראות מדויקות להפעלה מקומית ול-hosted project
- מסלול ה-callback של ה-hosted project: `https://dugjsiyenazpsoiyduuz.supabase.co/auth/v1/callback`

### 6.2 CRA — מדיניות דיווח פגיעויות

- `SECURITY.md`: נוסף סעיף "EU Cyber Resilience Act" — הערוץ הקיים (GitHub private vulnerability reporting) מוכרז כערוץ התיאום הנדרש, עם התחייבויות תיקון והודעה בלוחות הזמנים של ה-CRA (24 שעות ל-ENISA/CSIRT בניצול פעיל, הודעת משתמשים ללא דיליי)

### 6.3 אימות Target API 36

- אומת מקור: `react-native/gradle/libs.versions.toml` קובע `compileSdk = 36` / `targetSdk = 36` — הדדליין של 31.8.2026 עומד ב-build הבא

### 6.4 צ'קליסט עלייה לאוויר

- `docs/APP_STORE_LAUNCH_CHECKLIST.md` עודכן (2026-09-05) ונוסף לו סעיף 11 — כל הפעולות שנדרשות ב-Consoles: שאלון דירוג גיל 2026, Privacy Nutrition Labels / Data Safety לפי ה-manifest, נוסחת גילוי Expo Updates ל-review notes, 12-tester rule, Android Developer Verification, ואימות SiwA ב-release build

### 6.5 מה נשאר — רק פעולות מול Consoles חיצוניים

אין עוד עבודת קוד. צ'קליסט המשימות שנשארו, כולן ידניות:

**Builds (חוסם — בלי זה השינויים לא באוויר):**
- [ ] Build חדש של iOS (EAS/TestFlight) — כולל ה-manifest המעודכן, xcprivacy, תוספי ה-Share והווידג'ט
- [ ] Build חדש של Android (EAS/AAB) — כולל ביטול ההרשאה, כללי הגיבוי ו-target API 36

**Supabase Dashboard:**
- [ ] הפעלת ספק Apple: Services ID `com.itaykarkason.couponmaster`, secret key מחשבון המפתח, callback `https://dugjsiyenazpsoiyduuz.supabase.co/auth/v1/callback` (תבנית מקומית: `supabase/config.toml`)

**App Store Connect:**
- [ ] מילוי App Privacy (Nutrition Labels) לפי הטבלה בסעיף 1.2
- [ ] מענה על שאלון דירוג הגיל 2026 (13+/16+/18+)
- [ ] הדבקת גילוי Expo Updates ב-review notes (נוסחה מוכנה בצ'קליסט סעיף 4)
- [ ] קבלת הסכם מפתח עדכני אם יש מושהה
- [ ] אימות SiwA עד הסוף ב-build של TestFlight

**Google Play Console:**
- [ ] מילוי Data Safety לפי הטבלה בסעיף 1.2
- [ ] מתן כתובת מחיקת חשבון לחובה בטופס
- [ ] Closed testing: 12 בודקים / 14 יום (אם החשבון אישי חדש)
- [ ] אימות זהות מפתח — **דדליין 30.9.2026** (ברזיל/אינדונזיה/סינגפור/תאילנד)

---

## 7. רשימת קבצים ששונו או נוצרו

### קוד / קונפיגורציה

| קובץ | שינוי |
|---|---|
| `app.json` | הסרת `ACCESS_BACKGROUND_LOCATION`; ביטול background location ב-expo-plugin; מחיקת מחרוזות always-location; `ITSAppUsesNonExemptEncryption: false`; רישום `withAndroidBackupRules` |
| `app.config.ts` | הוספת `expo-secure-store` ל-plugins |
| `android/app/src/main/AndroidManifest.xml` | הסרת הרשאת מיקום רקע; `allowBackup="false"` + `dataExtractionRules` + `fullBackupContent` |
| `android/app/src/main/res/xml/data_extraction_rules.xml` | **חדש** — שלילת גיבוי של sharedpref/database (API 31+) |
| `android/app/src/main/res/xml/full_backup_content.xml` | **חדש** — מקביל ל-API < 31 |
| `plugins/withAndroidBackupRules.js` | **חדש** — config plugin שמיישם את כללי הגיבוי אחרי prebuild |
| `ios/CouponMaster/PrivacyInfo.xcprivacy` | מילוי `NSPrivacyCollectedDataTypes` (מייל, מזהה, תוכן משתמש, מיקום גס) |
| `src/lib/secureSessionStorage.ts` | **חדש** — אחסון session של Supabase ב-Keychain/Keystore עם chunking ומיגרציה מ-AsyncStorage |
| `src/integrations/supabase/client.ts` | החלפת AsyncStorage ב-`sessionStorage` המאובטח |
| `src/lib/pushNotifications.ts` | ניסוח מחדש של הודעה שכללה "localhost" |
| `package.json` / `package-lock.json` | הוספת `expo-secure-store` |

### Swift (נגישות)

| קובץ | שינוי |
|---|---|
| `targets/widget/CouponWidget.swift` | פונטים יחסיים (`caption2`) במקום גדלים קבועים; `accessibilityHidden` ללוגואים |
| `targets/add-share/ShareViewController.swift` | צבעים דינמיים ל-Increase Contrast; VoiceOver: mascot/badge דקורטיביים, הכרטיס כאלמנט מוכרז עם `announceState()` |
| `targets/share/ShareViewController.swift` | זהה לקובץ add-share |

### תיעוד

| קובץ | שינוי |
|---|---|
| `SECURITY.md` | סעיף CRA — מדיניות דיווח פגיעויות עם לוחות זמנים |
| `supabase/config.toml` | בלוק `[auth.external.apple]` מוער עם הוראות הפעלה |
| `docs/APP_STORE_LAUNCH_CHECKLIST.md` | סעיף 11 חדש (פעולות Consoles), עדכון סעיף מיקום ל-foreground-only, נוסחת גילוי OTA |
| `compliance-audit/README.md` | קישור למצב הטיפול |
| `compliance-audit/REMEDIATION-2026-09-05.md` | קובץ זה — התיעוד המרכזי |

### מצב אימות

- `npm test` — 310/310 עוברים
- `npm run typecheck` — נקי
- לא בוצע קומיט — השינויים מוחזקים מקומית על `main`, ממתינים לאישור
