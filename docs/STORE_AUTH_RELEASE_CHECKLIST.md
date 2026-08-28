# Checklist — התחברות ופרסום בחנויות

עדכון אחרון: 24 באוגוסט 2026

## מצב נוכחי

- [x] Google OAuth מופעל ב־Supabase.
- [x] Google OAuth מפנה דרך הלקוח `Coupon Master Web`.
- [x] שם האפליקציה במסך ההסכמה של Google הוא `Coupon Master`.
- [x] הלוגו החדש נשמר ב־Google OAuth Branding.
- [x] כתובת ה־callback של Google מוגדרת:
  `https://dugjsiyenazpsoiyduuz.supabase.co/auth/v1/callback`
- [x] האפליקציה תומכת בחיבור Google ו־Apple בקוד.
- [x] נוסף מסך לחיבור זהויות מתוך הפרופיל.
- [x] התחברות בסיסמה, Google ו־Apple משתמשות באותו `auth.users.id` כאשר הזהויות מקושרות.
- [x] Android מוגדר עם `targetSdkVersion 36` ו־`compileSdkVersion 36`.
- [x] Android production מוגדר כ־AAB.
- [x] נוספו `versionCode` והגדלה אוטומטית ב־EAS production builds.
- [x] הוסרה הרשאת overlay מיותרת מ־Android release manifest.
- [x] הרשאת מיקרופון מיותרת חסומה ב־Expo config.
- [x] נוסף Sign in with Apple entitlement לפרויקט iOS.
- [ ] Apple provider עדיין לא מופעל ב־Supabase.
- [ ] נדרשת בדיקת כניסה מלאה עם חשבון Google אמיתי.
- [ ] נדרשת בדיקת כניסה מלאה עם חשבון Apple אמיתי.

## 1. בדיקת Google OAuth מלאה

1. לבנות גרסת development או production במכשיר אמיתי.
2. לפתוח את מסך ההתחברות.
3. ללחוץ `המשך עם Google`.
4. לוודא שמסך Google מציג:
   - שם: `Coupon Master`.
   - הלוגו החדש.
   - הרשאות בסיסיות בלבד: `openid`, `email`, `profile`.
5. להתחבר עם חשבון בדיקה.
6. לוודא שהאפליקציה חוזרת מהדפדפן דרך:
   `couponmaster://auth/callback`
7. לוודא שהמשתמש רואה את הקופונים והנתונים שלו.
8. לצאת ולהתחבר שוב עם אימייל וסיסמה של אותו חשבון, אם הוגדרה סיסמה.
9. לוודא שהתקבל אותו משתמש פנימי ואותם נתונים.
10. לבדוק ב־Supabase Authentication שלאותו user יש כמה identities ולא כמה users.

### Google verification

העלאת לוגו עשויה לדרוש Brand Verification של Google.

1. להיכנס ל־Google Cloud Console.
2. לפתוח `Google Auth Platform` → `Verification Center`.
3. לוודא שה־Homepage ועמוד הפרטיות נגישים לציבור:
   - `https://coupons.itaykarkason.com`
   - `https://coupons.itaykarkason.com/privacy`
4. להוסיף Terms of Service URL אם קיים עמוד מתאים.
5. לוודא בעלות על הדומיין דרך Google Search Console.
6. לשלוח את המיתוג לאימות אם Google דורש זאת.
7. לא לבקש scopes נוספים בלי צורך.

## 2. הפעלת Sign in with Apple

### Apple Developer

1. להיכנס ל־Apple Developer → `Certificates, Identifiers & Profiles`.
2. לפתוח את App ID:
   `com.itaykarkason.couponmaster`
3. להפעיל Capability בשם `Sign in with Apple`.
4. לוודא שה־App ID משויך ל־Team ID:
   `TM252YSY6T`
5. ליצור Services ID עבור web/OAuth, לדוגמה:
   `com.itaykarkason.couponmaster.web`
6. לקשר את Services ID ל־App ID הראשי.
7. להגדיר Return URL:
   `https://dugjsiyenazpsoiyduuz.supabase.co/auth/v1/callback`
8. ליצור Sign in with Apple Key.
9. להוריד את קובץ `AuthKey_<KEY_ID>.p8` פעם אחת בלבד.
10. לשמור את קובץ ה־`.p8` במקום מאובטח. לא להוסיף אותו ל־Git.
11. לרשום בצד:
    - Team ID.
    - Key ID.
    - Services ID.
    - App ID / Bundle ID.
12. להגדיר `Sign in with Apple for Email Communication` אם רוצים לשלוח אימיילים למשתמשי Apple Relay.

### Supabase

1. להיכנס לפרויקט Supabase:
   `dugjsiyenazpsoiyduuz`
2. לפתוח `Authentication` → `Providers` → `Apple`.
3. להפעיל Apple provider.
4. להזין Client IDs בסדר הבא:
   - Services ID ראשון. נדרש ל־web OAuth.
   - Bundle ID שני. נדרש ל־native Apple Sign-In.
5. להזין Team ID.
6. להזין Key ID.
7. ליצור Apple client secret בעזרת קובץ ה־`.p8` ולהזין אותו.
8. לשמור.
9. לבדוק דרך:
   `https://dugjsiyenazpsoiyduuz.supabase.co/auth/v1/settings`
10. לוודא שמתקבל `external.apple: true`.

### בדיקת Apple

1. לבנות iOS build חדש. שינוי entitlement דורש build native חדש; EAS Update לא מספיק.
2. לבדוק במכשיר iPhone אמיתי.
3. לבצע כניסה עם `Share My Email`.
4. לצאת ולהיכנס שוב. לוודא שנשמר אותו user.
5. לבצע בדיקה נוספת עם `Hide My Email`.
6. אם כתובת Apple Relay שונה מהאימייל הקיים:
   - להתחבר קודם לחשבון הקיים.
   - לפתוח `פרופיל אישי` → `חיבורים לחשבון`.
   - לבחור `חיבור Apple`.
7. לוודא שב־Supabase נוצרה identity נוספת תחת אותו user.
8. לא למזג חשבונות אוטומטית לפי שם, טלפון או דמיון בפרטים.

## 3. כללי איחוד חשבונות

1. המזהה הראשי של משתמש הוא `auth.users.id`, לא כתובת האימייל.
2. Supabase מבצע linking אוטומטי רק כאשר ספקי OAuth מחזירים אותו אימייל מאומת.
3. Google וחשבון בסיסמה עם אותו אימייל מאומת אמורים להתאחד אוטומטית.
4. Apple `Hide My Email` מחזיר כתובת `privaterelay.appleid.com`; זו כתובת אחרת בכוונה.
5. במקרה של אימייל שונה, לבצע linking רק מתוך session מחובר באמצעות `linkIdentity()`.
6. לא לבצע merge מנהלי שקט בין שני users בלי אימות מחדש של שתי הזהויות.
7. לאחר linking, לבדוק שכל הקופונים ממשיכים להיות משויכים לאותו `public.users.id`.

## 4. הכנת Android לפרסום ב־Google Play

### קוד ו־build

- [x] package name: `com.itaykarkason.couponmaster`.
- [x] target SDK: API 36.
- [x] production artifact: Android App Bundle (`.aab`).
- [x] `versionCode` קיים.
- [x] EAS production build מגדיל build number אוטומטית.
- [ ] להגדיר Android production signing credentials ב־EAS.
- [ ] לבצע production build מוצלח.
- [ ] לבדוק את ה־AAB ב־Internal Testing.

פקודות:

```bash
npm run build:android:production
npm run submit:android:internal
```

בדיקת build מקומית דורשת Android SDK תקין ו־`ANDROID_HOME`. EAS Build אינו תלוי ב־Android SDK המקומי.

### EAS ו־Google Play Console

1. ליצור אפליקציה ב־Google Play Console עם package name זהה.
2. להפעיל Play App Signing.
3. להגדיר Android credentials דרך EAS.
4. ליצור Google Play Service Account עבור EAS Submit.
5. לתת ל־Service Account הרשאה מתאימה לאפליקציה ב־Play Console.
6. להעלות את מפתח ה־Service Account ל־EAS Credentials. לא להוסיף ל־Git.
7. לבנות production AAB.
8. להעלות תחילה ל־Internal Testing במצב draft.
9. להוסיף testers.
10. לבצע בדיקות התקנה, login, notifications, camera, location ו־biometrics.
11. לקדם ל־Closed/Open testing לפי הצורך.
12. רק לאחר QA לקדם ל־Production.

## 5. Store listing נדרש

1. שם אפליקציה.
2. תיאור קצר.
3. תיאור מלא.
4. App icon ברזולוציה הנדרשת.
5. Feature graphic.
6. צילומי מסך לטלפון.
7. קטגוריית אפליקציה.
8. פרטי קשר ותמיכה.
9. Privacy Policy URL ציבורי.
10. Terms of Service URL, אם רלוונטי.
11. Content rating questionnaire.
12. Ads declaration.
13. Target audience.
14. App access instructions לחשבון review, אם חלק מהאפליקציה דורש login.

## 6. פרטיות, Data Safety ומחיקת חשבון

### Data Safety

למלא לפי ההתנהגות בפועל של האפליקציה וה־SDKs:

1. פרטי חשבון: אימייל, שם ומזהה משתמש.
2. קופונים ותוכן שהמשתמש מזין.
3. תמונות/מצלמה עבור סריקת קופונים.
4. מיקום עבור רישום מקום שימוש בקופון.
5. push token עבור notifications.
6. crash/error diagnostics, אם נאספים.
7. להסביר מטרת איסוף, האם חובה או רשות, והאם מידע משותף לצד שלישי.
8. לוודא שכל מידע מוצפן בתעבורה.

### מחיקת חשבון — חסר לפני פרסום

Google Play דורש מסלול מחיקה בתוך האפליקציה וגם מסלול ציבורי מחוץ לאפליקציה.

1. להוסיף כפתור `מחיקת חשבון` במסך הגדרות/פרופיל.
2. להציג confirmation ברור לפני המחיקה.
3. למחוק או לאנונימיזציה את כל המידע המשויך:
   - קופונים.
   - שימושים ועסקאות.
   - notifications ו־push tokens.
   - שיתופים והרשאות.
   - פרטי פרופיל.
   - identities ו־Supabase Auth user.
4. לא להסתפק ב־soft delete אם Google Play מצפה למחיקה מלאה.
5. לתעד כל מידע שחייבים לשמור מסיבה חוקית או אבטחתית.
6. ליצור עמוד web ציבורי לבקשת מחיקה.
7. להכניס את כתובת העמוד ל־Play Console → Data Safety → Account deletion URL.
8. לבדוק שהעמוד עובד ללא צורך בהתקנת האפליקציה.

## 7. בדיקות לפני העלאה לחנות

- [ ] הרשמה חדשה באימייל וסיסמה.
- [ ] login חוזר באימייל וסיסמה.
- [ ] Google OAuth במכשיר Android אמיתי.
- [ ] Google OAuth במכשיר iPhone אמיתי.
- [ ] Apple Sign-In במכשיר iPhone אמיתי.
- [ ] linking של Google לחשבון קיים.
- [ ] linking של Apple לחשבון קיים עם Hide My Email.
- [ ] logout מכל סוגי החשבונות.
- [ ] מחיקת חשבון מלאה.
- [ ] camera permission וזרימת סריקה.
- [ ] location permission וסירוב להרשאה.
- [ ] notifications permission וסירוב להרשאה.
- [ ] biometric lock.
- [ ] התקנת AAB דרך Internal Testing.
- [ ] upgrade מגרסה קודמת בלי אובדן נתונים.
- [ ] RTL, טקסטים, קישורים ומדיניות פרטיות.
- [ ] בדיקה ללא network וב־network איטי.
- [ ] בדיקת crashes ו־ANRs ב־Play Console.

## 8. סדר ביצוע מומלץ

1. להשלים Apple Developer credentials.
2. להפעיל Apple provider ב־Supabase.
3. לבצע בדיקות Google ו־Apple במכשירים אמיתיים.
4. ליישם מחיקת חשבון מלאה ומסלול web חיצוני.
5. להשלים Google verification אם נדרש.
6. ליצור Play Console app ו־Service Account.
7. לבנות production AAB.
8. להעלות ל־Internal Testing.
9. להשלים Store Listing ו־Data Safety.
10. לבצע QA סופי.
11. לקדם ל־Production review.

## מקורות רשמיים

- [Supabase — Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase — Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Google — Sign in with Google best practices](https://developers.google.com/identity/siwg/best-practices)
- [Expo — Submit to Google Play](https://docs.expo.dev/submit/android/)
- [Expo — App version management](https://docs.expo.dev/build-reference/app-versions/)
- [Google Play — Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Google Play — Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play — Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
