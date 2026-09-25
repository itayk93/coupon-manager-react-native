# התראות Dynamic Island והתראות AI

## מאיפה זה התחיל

המשתמש שלח רילס מאינסטגרם (`instagram.com/reel/DdpYMkNRMRS`) וביקש לנתח אותו, אודיו ווידאו, בעזרת סקיל שנמצא באינטרנט. אחר כך ביקש לבדוק איך אפשר לעשות את אותו הדבר באפליקציית הקופונים ואילו התראות מבוססות AI אפשר לבנות.

### ניתוח הסרטון

- **הסקיל:** `watch` מתוך [bradautomates/claude-video](https://github.com/bradautomates/claude-video). הוא מוריד את הסרטון, מחלץ ממנו פריימים ומתמלל את האודיו.
- **ההורדה:** אינסטגרם חסמה את yt-dlp (שגיאת 429). קובץ ה-MP4 נלקח מעמוד ההטמעה הציבורי של הפוסט (`/embed/captioned/`).
- **וידאו:** נחלץ פריים אחד לכל שנייה עם ffmpeg ונבנתה מהם רשת של 7×4 תמונות.
- **אודיו:** תומלל עם faster-whisper (מודל small). השפה שזוהתה: אנגלית.
- **התוכן:** הסרטון (26 שניות, של archieauburn) מציג את [rit3zh/expo-dynamic-notifications](https://github.com/rit3zh/expo-dynamic-notifications). זו ספריית React Native בקוד פתוח (רישיון MIT) להתראות בתוך האפליקציה ש"נשפכות" מה-Dynamic Island, בנויה על Skia, Reanimated ו-Gesture Handler. בתמלול: "You can now make these dynamic island notifications in your app… custom avatars, SF symbols and custom durations… the exact same swipe-to-dismiss gestures used in iOS itself."

## מה נבנה

### 1. הספרייה

- הקוד הועתק ל-`src/components/dynamic-notifications/`, יחד עם הרישיון וקובץ README שמתעד את השינויים המקומיים. הריפו המקורי הוא אפליקציית דוגמה ולא חבילת npm, ולכן אי אפשר להתקין אותו כתלות.
- **חבילות נייטיב חדשות:** `@shopify/react-native-skia`, `expo-blur`, `expo-image`, `expo-symbols`.
- **שינוי מקומי אחד:** ה"אי" המצויר מוצג רק כשיש התראה. בקוד המקורי הוא מצויר כל הזמן, ולכן היה מופיע בכל צילום מסך של האפליקציה.

### 2. השכבה של האפליקציה: `src/components/ui/Island.tsx`

- `pushIsland({ title, message, onPress, face })` עובד באותו מבנה של `pushToast`. `IslandHost` מורכב פעם אחת ב-`app/_layout.tsx`.
- **איפה ה"אי" מופיע:** רק באייפון עם Dynamic Island. זה מזוהה לפי ה-inset העליון בזמן ההפעלה (54 נקודות ומעלה, מחושב פעם אחת).
- **בכל מקום אחר** (אנדרואיד, ווב, אייפד, אייפון עם notch) מוצג ה-Toast הרגיל, כך שמי שקורא לפונקציה לא צריך לבדוק את זה.
- **טעינה מוגנת:** הספרייה נטענת ב-`require` בתוך try/catch. הסיבה: `runtimeVersion` קבוע על `1.0.0`, אז עדכון OTA מגיע גם לבינארים ישנים בלי Skia. במצב כזה המשתמש פשוט מקבל Toast.
- **עיצוב:** מימין לשמאל, פונט Heebo וצבעי ה-theme. יש אייקון ✨ להתראות של הזיהוי החכם, ופרצוף של קופוני להתראות Push.

### 3. ההתראות

| התראה | מתי | איפה בקוד | ערוצים |
|---|---|---|---|
| **זיהינו קופון** | ה-AI מפענח קופון (טקסט, תמונה, ברקוד, צילום מסך ששותף) והטופס נפתח מלא | `BarcodeScannerScreen`, `SharedScreenshotUsage`, `lib/islandCopy.ts` | Island, או Toast |
| **עדכנו שימוש** | שמירת שימושים שה-AI זיהה מצילום מסך או SMS | `QuickUsageModal`, `recordedUsageIsland` | Island, או Toast (אחרי שה-modal נסגר, כי ב-iOS הוא מכסה את ה"אי") |
| **כל 8 סוגי ה-Push הקיימים** | Push שמגיע כשהאפליקציה פתוחה | `hooks/useNotificationRouting.ts`, `lib/nativeNotifications.ts` | Island עם הפרצוף שהשרת בחר, במקום הבאנר של המערכת |
| **לחיצה על Push** | לחיצה על התראה, גם כשהאפליקציה סגורה | `useNotificationRouting`, `lib/notificationRoute.ts` | ניווט ל-`data.url` |
| **עם איזה קופון להתחיל השבוע** (`weekly_pick`) | ביום ראשון, בשעון של המשתמש | `send-engagement-alerts`, `_shared/weeklyPick.ts` | Push, in-app (ברירת מחדל) |
| **היתרה ירדה בלי שימוש רשום** (`unrecorded_usage`) | בדיקת יתרה אוטומטית מצאה פחות כסף ממה שרשום | `update-balance`, `splitBalanceChanges` | Push, in-app, מייל |
| **{מקום} ממש קרוב** | פתיחת האפליקציה או חזרה אליה ליד מקום שבו כבר נוצל קופון של אותה חברה | `components/layout/NearbyCouponWatcher.tsx`, `lib/nearbyCoupon.ts` | Island, או Toast. פעם ביום לכל מקום |

### עקרון ה-AI

כמו בשאר המערכת (`notificationVoice.ts`), **המודל רק מנסח ולא מחליט**:

- **הבחירה עצמה היא חישוב על הנתונים של המשתמש.** בהתראה השבועית זה היתרה חלקי מספר הימים עד התפוגה. בהתראת ירידת היתרה זה פער בין מה שנמצא בבדיקה לבין מה שרשום.
- **הניסוח הוא של gpt-5-mini**, ועובר את אותן בדיקות כמו תמיד: בלי מספרים חדשים, עברית, מגבלת אורך. אם משהו לא עובר, חוזרים למשפט הקבוע.
- **בצד הלקוח** ה-AI הוא המפענח הקיים (`parse-coupon`, `parse-usage-screenshot`). ה"אי" רק אומר מה זוהה.

### החלטות

- **"ליד חנות" עובד רק כשהאפליקציה פתוחה, ורק אם כבר ניתנה הרשאת מיקום.** האפליקציה לא מבקשת הרשאה בשביל תזכורת. גרסה ברקע (geofencing) דורשת הרשאת "תמיד" והסבר ל-App Store, וזו החלטת מוצר.
- **המקומות הם אלה שבהם המשתמש כבר ניצל קופונים** (`useWhereBought`), כך שאין מאגר חנויות לתחזק.
- **ל-`weekly_pick` אין מייל** כי זה תכנון ולא אזעקה. ההתראה לא נשלחת על קופון שפג בעוד פחות מ-8 ימים, כי תזכורות התפוגה כבר מכסות אותו.
- **`unrecorded_usage` נשלחת בכל הערוצים**, כי אולי מישהו אחר השתמש בקופון. ההתראה נשלחת פעם אחת לכל יתרה שנמצאה.
- **שני הסוגים החדשים משתמשים בפרצופים קיימים:** `expiry-week` ו-`balance-updated`. עוד אין להם פרצופים משלהם.
- **"קופון כפול" לא נכלל**, כי כבר יש על זה דיאלוג אישור בטופס.
- **לא נדרשה מיגרציה:** `notifications.type` הוא טקסט, ו-`type_channels` הוא jsonb.

## בדיקות

- `npm test`: 559/559 עוברות. נוספו `islandCopy`, `notificationRoute`, `weeklyPick`, `nearbyCoupon`, ובדיקות ניסוח לשני הסוגים החדשים.
- `npm run typecheck`: נקי.
- `deno check` על `send-engagement-alerts` ו-`update-balance`: נקי.
- `expo export` ל-iOS ולווב: נבנים. קוד הספרייה נמצא בבאנדל של iOS.

### מה לא נבדק

- **האנימציה על מכשיר אמיתי.** לא היה סימולטור בסשן. צריך לבדוק על אייפון 14 Pro ומעלה, גם במצב כהה.
- **שליחה אמיתית של שני הסוגים החדשים.** `weekly_pick` נשלח רק ביום ראשון, ו-`unrecorded_usage` רק אחרי בדיקת יתרה שמוצאת ירידה.

## מה צריך לעשות כדי שזה יעבוד

1. **בילד חדש ב-EAS** (`npm run build:dev:ios` או פרודקשן), כי נוספו מודולים נייטיב.
2. **~~פריסה של פונקציות ה-edge~~ — בוצע:**
   - `update-balance` נפרסה בגרסה 47 (`verify_jwt=true`).
   - `send-engagement-alerts` נפרסה בגרסה 21 (`verify_jwt=false`, כמו ב-`config.toml`, כי pg_cron מזדהה עם טוקן).
   - הפריסה נעשתה דרך ה-connector של Supabase. אחריה הקוד החי נמשך בחזרה והושווה לריפו: כל הקבצים זהים חוץ מ-`_shared/rtlText.ts`, שבו הפלטפורמה ממירה `\u200F` לתו עצמו. זה אותו הבדל שהיה גם בגרסה הקודמת, והמשמעות בקוד זהה.
3. **בדיקה ידנית:**
   - סריקת קופון.
   - שיתוף צילום מסך של שימוש.
   - Push בדיקה מהגדרות ההתראות כשהאפליקציה פתוחה.
   - לחיצה על Push כשהאפליקציה סגורה.

## המשך אפשרי

- פרצופים ייעודיים ל-`weekly-pick` ול-`unrecorded-usage`.
- גרסת רקע ל"ליד חנות", אם מחליטים לבקש הרשאת מיקום "תמיד".
- להציג שורות in-app חדשות בתור "אי" גם כשה-Push כבוי (Supabase Realtime על `notifications`).
