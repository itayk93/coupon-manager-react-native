# סיכום סשן 24–25.08.2026 — Google OAuth, חזרה לאפליקציה והרשאות Native

## מטרת הסשן

טיפול בשלוש בעיות קשורות:

1. במסך ההתחברות של Google הופיע הדומיין הטכני של Supabase במקום המותג Coupon Master.
2. לאחר התחברות Google המשתמש הועבר לאתר במקום לחזור לאפליקציה.
3. בדיקת כל הרשאות Google OAuth והרשאות ה־Native, כדי לוודא שהאפליקציה מבקשת רק מה שנדרש.

## מצב התחלתי

- האפליקציה משתמשת ב־Supabase Auth עבור Google OAuth.
- פרויקט Supabase: `dugjsiyenazpsoiyduuz` (`MaCoupon`).
- פרויקט Google Cloud: `coupon-master-450421` (`Coupon Master`).
- ה־scheme של האפליקציה: `couponmaster`.
- Site URL ב־Supabase: `https://coupons.itaykarkason.com`.
- במסך בחירת החשבון של Google הוצג:
  `dugjsiyenazpsoiyduuz.supabase.co`.

## 1. תיקון החזרה לאפליקציה אחרי Google OAuth

### האבחון

הקוד יצר את כתובת החזרה באמצעות:

```ts
Linking.createURL("auth/callback")
```

ב־Native כתובת זו עלולה להפוך ל־`couponmaster:///auth/callback` עם שלושה לוכסנים.
הכתובת לא הופיעה ב־Supabase Redirect URLs. כאשר `redirectTo` לא תואם ל־allowlist,
Supabase חוזר ל־Site URL. לכן ההתחברות הסתיימה באתר.

### ההחלטה

להשתמש בכתובת Native מפורשת ויציבה:

```text
couponmaster://auth/callback
```

ב־Web ממשיכים להשתמש בכתובות Web שנוצרות באמצעות Expo Linking.

### מה בוצע

- `src/lib/socialAuth.ts` עודכן להשתמש ב־`couponmaster://auth/callback` עבור התחברות וקישור identity ב־Native.
- הכתובת `couponmaster://auth/callback` נוספה ל־Supabase Authentication → URL Configuration → Redirect URLs.
- נבדק שה־scheme רשום ב־iOS וב־Android.

### Commit

```text
6eaeb23 fix: return OAuth login to native app
```

## 2. למה Google הציג `supabase.co`

### האבחון

Google OAuth הוגדר עם:

- App name: `Coupon Master`
- לוגו של Coupon Master
- Support email
- Homepage ו־Privacy Policy
- Authorized domains מתאימים

למרות זאת, בזרימת OAuth מבוססת Supabase, Google רואה את callback של Supabase:

```text
https://dugjsiyenazpsoiyduuz.supabase.co/auth/v1/callback
```

לכן Google עשוי להציג את hostname של Supabase. שינוי App name לבדו לא מחליף hostname זה.

### מסלולים אפשריים שנשקלו

1. **Supabase Custom Domain** — לדוגמה `auth.couponmasteril.com`.
   זה הפתרון הישיר להסרת `.supabase.co` מזרימת OAuth של Supabase, אך הפרויקט נמצא בתוכנית Free
   והפעלת Custom Domain עשויה לדרוש שדרוג בתשלום.
2. **Native Google Sign-In** — זרימה נפרדת עם Google SDK ו־ID token, ואז
   `signInWithIdToken` מול Supabase. פתרון זה דורש שינוי ארכיטקטורת ההתחברות ו־OAuth clients נפרדים
   ל־iOS/Android. הוא לא בוצע בסשן.
3. **אימות Branding ב־Google** — נדרש כדי ששם ולוגו Coupon Master יוצגו למשתמשים במקום מצב
   שבו המיתוג מוגדר אך מוסתר.

### ההחלטה

- לא להפעיל שירות בתשלום ללא אישור מפורש.
- לתקן את Branding verification של Google.
- להשאיר את Custom Domain או Native Google Sign-In כהמשך אפשרי אם רוצים להסיר לחלוטין את
  הדומיין הטכני של Supabase.

## 3. תיקון Google Branding verification

### מצב שנמצא ב־Google Cloud

ב־Verification Center הופיע:

```text
Your branding is not being shown to users.
```

בדיקת Google נכשלה משתי סיבות:

1. דף הבית היה מאחורי מסך התחברות.
2. דף הבית לא הסביר את מטרת האפליקציה.

### ההחלטה

להפוך את דפי התוכן הציבוריים לנגישים ללא session ולהשתמש ב־`/about` בתור Application home page.

### מה בוצע

- Auth guard ב־`app/_layout.tsx` עודכן לאפשר גישה ציבורית אל:
  - `/about`
  - `/faq`
  - `/privacy`
  - `/issues`
- `/about` מסביר ש־Coupon Master הוא ארנק דיגיטלי לניהול קופונים ושוברים ומציג את היכולות המרכזיות.
- האתר נבנה ונפרס ל־Vercel production.
- נבדק בפועל ש־`https://coupons.itaykarkason.com/about` נפתח ומציג את מטרת האפליקציה.
- Google Application home page עודכן אל:

```text
https://coupons.itaykarkason.com/about
```

### Commit

```text
a17d285 fix: expose public app information pages
```

### מצב פתוח

בקשת re-verification חדשה ל־Google עדיין לא נשלחה בסוף הסשן. ההגשה היא פעולה רשמית בשם
חשבון Google של בעל הפרויקט ולכן נדרש אישור מפורש לפני השליחה.

## 4. בדיקת Google OAuth scopes

Google Cloud → Google Auth Platform → Data Access נבדק ישירות.

התוצאה:

- Non-sensitive scopes: אין scopes נוספים מוצגים.
- Sensitive scopes: אין.
- Restricted scopes: אין.
- אין גישה ל־Gmail, אנשי קשר, Drive, Calendar או מידע פרטי נוסף.
- ההתחברות משתמשת בזיהוי הבסיסי הנדרש ל־Sign in with Google דרך Supabase.

החלטה: לא להוסיף scopes נוספים. אין צורך לשנות את Data Access.

## 5. Audit של הרשאות Native

### הרשאות שנשארו

#### מצלמה

נדרשת עבור:

- סריקת ברקודים ב־`BarcodeScannerScreen`.
- צילום קופון לצורך זיהוי פרטים מתמונה.

ההרשאה נשארה.

#### גלריית תמונות

נדרשת לבחירת צילום מסך או תמונת קופון והעברתה למנתח הקופונים.
ההרשאה נשארה.

#### Notifications

נדרשת עבור Push notifications ותזכורות תפוגה.

- ב־Native ההרשאה נבדקת ומתבקשת רק כאשר המשתמש מפעיל Push.
- ב־Android נדרש `POST_NOTIFICATIONS`.
- `VIBRATE` וערוץ notifications משמשים את מערכת ההתראות.

ההרשאה נשארה.

#### מיקום בזמן שימוש

נדרש עבור:

- כפתור "המיקום שלי" בעת רישום שימוש בקופון.
- הצגת מקום השימוש ומפות.

ההרשאה מתבקשת רק בעקבות פעולה מפורשת של המשתמש.
נשארו `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` ו־iOS When In Use.

נוסח iOS עודכן כדי להסביר מתי ולמה המיקום משמש:

```text
האפליקציה משתמשת במיקום שלך רק לאחר לחיצה על 'המיקום שלי', כדי לרשום היכן השתמשת בקופון.
```

#### ביומטריה

נדרשת עבור נעילת הארנק באמצעות Face ID או fingerprint.
הרשאות `USE_BIOMETRIC`, `USE_FINGERPRINT` ו־`NSFaceIDUsageDescription` נשארו.

#### אינטרנט

נדרש לתקשורת עם Supabase, OAuth, Push, מפות ושירותי האפליקציה.
`INTERNET` נשאר.

#### אחסון Android ישן

`READ_EXTERNAL_STORAGE` ו־`WRITE_EXTERNAL_STORAGE` מוגבלות לגרסאות Android ישנות באמצעות
`maxSdkVersion`. הן נדרשות לתמיכה בבחירת תמונות במכשירים ישנים ולא מעניקות הרשאת אחסון רחבה
בגרסאות Android חדשות.

### הרשאות שהוסרו או נחסמו

#### מיקרופון והקלטת אודיו

לא נמצא שימוש במיקרופון.

- `microphonePermission: false` הוגדר ל־`expo-camera`.
- `recordAudioAndroid: false` הוגדר ל־`expo-camera`.
- `microphonePermission: false` הוגדר ל־`expo-image-picker`.
- `NSMicrophoneUsageDescription` הוסר מ־iOS.
- Android `RECORD_AUDIO` נשאר חסום.

#### מיקום ברקע או Always

האפליקציה משתמשת רק במיקום foreground אחרי לחיצה מפורשת.

- `locationAlwaysAndWhenInUsePermission: false`
- `locationAlwaysPermission: false`
- `isIosBackgroundLocationEnabled: false`
- `isAndroidBackgroundLocationEnabled: false`

#### Motion permission

אפקט הטיה ויזואלי אינו מצדיק הרשאת Motion למשתמש.

- `motionUsagePermission: false` הוגדר ב־`expo-location`.
- `motionPermission: false` הוגדר ב־`expo-sensors`.

במכשיר שבו Device Motion אינו זמין, האפקט כבר נכשל בצורה שקטה והאפליקציה ממשיכה ללא האפקט.

#### Local Network ו־Bonjour

אלו הגדרות של Expo Dev Launcher, לא פיצ'ר production.

- `NSLocalNetworkUsageDescription` ו־`NSBonjourServices` הוסרו מה־Info.plist הקיים.
- Config plugin של Expo Dev Launcher עדיין עשוי להציג אותן ב־introspection של סביבת פיתוח.
- Expo Dev Launcher כולל build phase שמסיר את `_expo._tcp` ואת תיאור Local Network בבניית Release.

### Commits

```text
51e3f58 fix: minimize native app permissions
c2e6e20 fix: disable unused motion permission
```

## 6. בדיקות שבוצעו

- `npm run typecheck` — עבר.
- `npm test` — 8 קובצי בדיקה, 34 בדיקות עברו.
- `npx expo export --platform web --output-dir dist` — עבר.
- Vercel production deployment — הסתיים במצב `READY`.
- Expo config introspection — נבדקו iOS usage descriptions והרשאות Android.
- `plutil -lint ios/CouponMaster/Info.plist` — עבר.
- `git diff --check` — עבר.
- כל השינויים נכתבו ישירות ל־`main` ונדחפו ל־remote.

## 7. רשימת החלטות סופית

1. Native OAuth חוזר תמיד דרך `couponmaster://auth/callback`.
2. כתובת זו חייבת להישאר ב־Supabase Redirect URLs.
3. דפי About, FAQ, Privacy ו־Issues נשארים ציבוריים.
4. Google Application home page נשאר `https://coupons.itaykarkason.com/about`.
5. לא מוסיפים Google OAuth scopes מעבר לזיהוי בסיסי.
6. לא מבקשים מיקרופון, אודיו, background location, Always location או Motion.
7. מצלמה, תמונות, notifications, foreground location וביומטריה נשארים כי קיימים עבורם פיצ'רים פעילים.
8. לא מפעילים Supabase Custom Domain בתשלום ללא אישור.
9. שינויי הרשאות Native דורשים build חדש של iOS/Android; deployment של Web אינו מעדכן binary שכבר מותקן.

## 8. המשך עבודה מומלץ

1. לשלוח Google Branding re-verification לאחר אישור מפורש.
2. לבצע build production חדש ל־iOS ול־Android.
3. לבדוק במכשירים אמיתיים:
   - Google login חוזר לאפליקציה.
   - מצלמה נשאלת רק בכניסה לסורק או בצילום קופון.
   - גלריה נשאלת רק בבחירת תמונה.
   - Notifications נשאלות רק בהפעלת Push.
   - מיקום נשאל רק בלחיצה על "המיקום שלי".
   - לא מופיעה בקשת מיקרופון, Motion, Local Network או background location ב־Release.
4. אם חובה להסיר לחלוטין את `.supabase.co` ממסך Google, לבחור בין Supabase Custom Domain לבין
   מעבר ל־Native Google Sign-In.
