# מזהים ציבוריים לקופונים ולמשתמשים — תכנון, מיגרציה ותפעול E2E

## מטרת המסמך

מסמך זה מתעד את המעבר ממזהים מספריים עוקבים למזהים ציבוריים אטומים עבור שתי הישויות המרכזיות במערכת:

- קופונים: `coupon.public_id`
- משתמשים: `users.public_id`

המסמך מתאר את המצב לפני השינוי, ההחלטות הארכיטקטוניות, המיגרציות, השינויים באפליקציה וב־Edge Functions, התאימות לאחור, בדיקות הקבלה, שיקולי אבטחה, פריסה, ניטור ו־rollback.

המטרה אינה למחוק את המפתחות המספריים הקיימים. המטרה היא להפסיק לחשוף אותם בגבולות ציבוריים כגון URLs, payloads של API, הודעות, widgets וטוקנים שנשלחים מחוץ למערכת.

## תקציר ההחלטה

לכל ישות נשמרים שני מזהים בעלי תפקידים שונים:

| ישות | מזהה פנימי | מזהה ציבורי | פורמט |
|---|---|---|---|
| קופון | `coupon.id` מסוג `integer` | `coupon.public_id` מסוג `text` | `cpn_` ועוד 20 ספרות hex אקראיות |
| משתמש | `users.id` מסוג `integer` | `users.public_id` מסוג `text` | `usr_` ועוד 20 ספרות hex אקראיות |

בנוסף, למשתמש קיים מזהה שלישי:

- `users.auth_user_id` מסוג UUID: קישור פנימי אל `auth.users.id` של Supabase Auth.

`auth_user_id` אינו מזהה ציבורי. אין להציג אותו, לשלב אותו ב־URL או להשתמש בו כמזהה מוצר. הוא שייך לשכבת ההזדהות ועלול לקשור את API המוצר ישירות לספק ההתחברות.

## למה לא החלפנו את ה־primary keys

`coupon.id` ו־`users.id` מחוברים לעשרות foreign keys, פונקציות, jobs, triggers, RLS policies, caches ו־native widgets.

החלפת המפתח הראשי עצמו הייתה דורשת:

1. הוספת UUID או text לכל טבלה תלויה.
2. backfill לכל קשר.
3. dual-write ממושך.
4. החלפת foreign keys ואינדקסים.
5. שינוי RLS helpers כגון `app_user_id()`.
6. שינוי כל Edge Function וכל שאילתה ישירה.
7. טיפול בנתונים cached במכשירים ובקישורים ישנים.
8. חלון סיכון גדול לנעילות, FK שבורים ואובדן גישה.

אין לכך יתרון מוצרי. מזהה פנימי מספרי יעיל מאוד ל־joins ולאינדקסים. מזהה ציבורי אטום פותר את בעיית החשיפה וה־enumeration בלי לפרק את הסכמה.

## למה זה לא hash של המספר

המזהים החדשים אינם hash של `id`.

Hash של מספר עוקב יוצר בעיות:

- ללא secret ניתן לחשב או לנחש אותו.
- עם secret נוצרת תלות קבועה ב־salt/key.
- החלפת secret שוברת את כל הקישורים.
- קיצור hash מחייב ניהול collisions.
- אותו קלט תמיד יוצר אותו פלט ולכן המבנה נשאר נגזר מהמזהה הפנימי.

במקום זאת נוצר token אקראי עצמאי באמצעות `gen_random_uuid()`. מוסרים את המקפים, לוקחים 20 תווי hex ומוסיפים prefix שמציין את סוג המשאב.

דוגמאות:

```text
cpn_a91a1bbabeb949fda421
usr_f9f1c80b0d1848838704
```

20 תווי hex מספקים 80 bits של entropy. בנוסף קיים unique index שמבטיח שה־DB ידחה collision גם במקרה התיאורטי הנדיר.

## עקרונות מחייבים

1. `id` מספרי נשאר פנימי.
2. `public_id` הוא המזהה לכל גבול ציבורי חדש.
3. מזהה ציבורי נוצר פעם אחת ואינו משתנה.
4. לקוח אינו רשאי לבחור או לעדכן `public_id`.
5. URLs חדשים אינם כוללים מזהה מספרי.
6. payloads חדשים של Edge API משתמשים ב־public ID כאשר זהות המשאב מגיעה מהלקוח.
7. קישורים וטוקנים ישנים ממשיכים לעבוד בתקופת התאימות.
8. `public_id` אינו מנגנון הרשאה. RLS ובדיקת ownership נשארים חובה.

# חלק א׳ — מזהי קופונים

## מצב קודם

קופונים זוהו בכל המערכת באמצעות מספרים עוקבים:

```text
/coupons/1
/coupons/2
/coupons/831
```

המספר הופיע בנתיבי Expo Router, deep links, widgets, התראות, מיילים וקריאות ל־`coupon-vault`.

גם כאשר RLS מנע קריאת קופון של משתמש אחר, המספר חשף שמדובר ב־sequence ואפשר enumeration של מרחב המזהים.

## שינוי DB

המיגרציה:

```text
supabase/migrations/20260828121306_add_coupon_public_id.sql
```

המיגרציה מבצעת:

1. הוספת `coupon.public_id`.
2. default אקראי לקופונים חדשים.
3. backfill לכל הקופונים הקיימים.
4. `NOT NULL`.
5. constraint לפורמט `^cpn_[0-9a-f]{20}$`.
6. unique index בשם `coupon_public_id_key`.

## התנהגות באפליקציה

הפונקציה `couponRouteId()` מחזירה:

- `coupon.public_id` עבור נתונים חדשים.
- `String(coupon.id)` כ־fallback לנתונים cached מלפני המיגרציה.

כל ניווט חדש לקופון משתמש ב־`couponRouteId()` או ב־`public_id` ישירות:

- dashboard
- רשימת קופונים
- מסך פרטי קופון
- עריכת קופון
- סטטיסטיקות
- drilldowns
- company sheet
- expiry banner
- notifications
- onboarding coupon claim

## coupon-vault

פעולת `get` מקבלת שני מסלולים:

```json
{ "action": "get", "publicId": "cpn_a91a1bbabeb949fda421" }
```

או, לתאימות לאחור:

```json
{ "action": "get", "id": 831 }
```

בשני המקרים השאילתה כוללת ownership לפי המשתמש המחובר. public ID אטום אינו מחליף בדיקת בעלות.

## widgets

Payload ה־widget כולל כעת:

```ts
{
  id: number;       // internal identity and logo cache key
  publicId: string; // deep link identity
}
```

iOS ו־Android פותחים:

```text
couponmaster:///coupons/{publicId}
```

Payload ישן ללא `publicId` ממשיך לעבוד באמצעות fallback ל־`id`.

## התראות וקישורים

עודכנו:

- nearby notification מקומי.
- balance update notification.
- Multipass daily usage notification.
- expiry email לקופון יחיד.
- idle-money notification עם כמה קופונים.
- in-app live expiry items.

התראת idle-money מעבירה רשימת public IDs ב־query parameter:

```text
/coupons?ids=cpn_xxx,cpn_yyy
```

מסך רשימת הקופונים יודע לקרוא public IDs. הוא ממשיך לקבל גם מספרים מקישורים ישנים.

## תוצאות backfill ובדיקת קופון חדש

בזמן הפריסה נבדקו 446 קופונים:

- 446 שורות.
- 446 public IDs ייחודיים.
- 0 ערכים חסרים.
- 0 ערכים בפורמט שגוי.

בדיקת E2E זמנית הוסיפה קופון בתוך transaction וקיבלה:

```text
cpn_a91a1bbabeb949fda421
```

הקופון נקרא בחזרה עם אותו public ID. לאחר מכן בוצע `ROLLBACK` ונבדק שנשארו 0 שורות בדיקה.

# חלק ב׳ — מזהי משתמשים

## שלושת מזהי המשתמש

| עמודה | תפקיד | מותר לחשיפה? |
|---|---|---|
| `users.id` | PK פנימי ו־FK לכל נתוני המוצר | לא בגבול ציבורי חדש |
| `users.public_id` | זהות מוצר ציבורית אטומה | כן |
| `users.auth_user_id` | קישור אל Supabase Auth | לא |

## שינוי DB

המיגרציה:

```text
supabase/migrations/20260828193933_add_user_public_id.sql
```

המיגרציה מבצעת:

1. הוספת `users.public_id`.
2. default אקראי למשתמשים חדשים.
3. backfill לכל המשתמשים הקיימים.
4. `NOT NULL`.
5. constraint לפורמט `^usr_[0-9a-f]{20}$`.
6. unique index בשם `users_public_id_key`.
7. comment שמתעד שאסור להשתמש ב־`auth_user_id` כמזהה ציבורי.
8. grant קריאה לעמודה עבור `authenticated`.
9. trigger שמונע שינוי public ID לאחר יצירה.

## למה נדרש grant מפורש

`public.users` מוגנת באמצעות הרשאות SELECT ברמת עמודה. המיגרציה `0013_hide_password_column.sql` ביטלה table-level SELECT והחזירה הרשאה לכל עמודה מלבד `password`.

עמודה שנוספת מאוחר יותר אינה מקבלת אוטומטית הרשאת קריאה. לכן המיגרציה כוללת:

```sql
grant select (public_id) on public.users to authenticated;
```

RLS ממשיך להחליט אילו שורות נראות. ה־grant רק מאפשר לעמודה להשתתף בשאילתה מותרת.

## immutability

Trigger בשם `guard_users_public_id` רץ לפני כל UPDATE ומחזיר את הערך הישן:

```sql
new.public_id := old.public_id;
```

ההגנה חלה גם אם לקוח שולח public ID אחר במפורש. public ID אינו nickname ואינו editable profile field.

## Auth ו־session

`LegacyUser` מכיל כעת `public_id`.

הוא מסומן optional רק כדי לא לשבור session שנשמר במכשיר לפני rollout. לאחר refresh מהשרת, session מקבל public ID.

עודכנו:

- password login רגיל.
- legacy password login.
- Google OAuth / Apple OAuth דרך `AuthContext`.
- session cache ב־AsyncStorage.
- profile/admin queries דרך `USER_COLUMNS`.
- `requireUser()` המשותף לכל Edge Functions.

`requireUser()` מחזיר גם `id` פנימי וגם `public_id`. Edge Function משתמש ב־`id` ל־DB joins וב־`public_id` לאימות מזהה שהגיע מהלקוח.

## API identity migration

`requireSameUser()` מקבל כעת:

- `usr_...` עבור clients חדשים.
- integer string עבור clients ישנים.

השרת משווה את הקלט גם ל־`authenticatedUser.public_id` וגם ל־`authenticatedUser.id`.

כך נשמרת תאימות לאחור בזמן שאפליקציות מותקנות מתעדכנות.

Clients חדשים שולחים public ID אל:

- `manage-user-tour`
- `update-balance`

ה־DB ממשיך להשתמש ב־integer `user_id` לאחר שהשרת פתר את זהות המשתמש מתוך JWT.

## Push notifications

בעבר web push client שלח `user_id` מספרי בגוף הבקשה, אף שהשרת התעלם ממנו והשתמש ב־JWT.

הפרמטר הוסר לחלוטין:

- subscribe
- test-user
- first PWA prompt

השרת הוא מקור האמת לזהות. אין צורך לשלוח שום user ID בפעולות push.

## unsubscribe tokens

לפני השינוי payload חתום הכיל:

```json
{
  "user_id": 123,
  "email": "...",
  "type": "unsubscribe"
}
```

החתימה מנעה שינוי payload, אך Base64 אינו הצפנה. לכן המספר היה ניתן לקריאה מתוך הקישור.

טוקנים חדשים מכילים:

```json
{
  "user_public_id": "usr_f9f1c80b0d1848838704",
  "email": "...",
  "type": "unsubscribe"
}
```

`manage-unsubscribe` מאמת את החתימה ואז מאתר משתמש לפי `public_id`.

טוקנים ישנים עם `user_id` ממשיכים לעבוד. זה חשוב מפני שמיילים ישנים נשארים בתיבות משתמשים זמן רב.

עודכנו כל יצרני הטוקנים:

- marketing newsletters
- expiry emails
- engagement emails דרך `deliver()`
- List-Unsubscribe headers לפי RFC 8058

## נתונים שנשארים מספריים בכוונה

השדות הבאים נשארים integer:

- foreign keys כגון `coupon.user_id`.
- `notification_preferences.user_id`.
- `push_subscriptions.user_id`.
- referrals פנימיים.
- activity logs.
- RLS helper `app_user_id()`.
- notification dedupe keys פנימיים.
- internal job payloads בין שירותים אמינים.

אלו אינם user-facing identifiers. החלפתם אינה נדרשת כדי לספק public user ID ותגדיל סיכון ללא תועלת.

# תאימות לאחור

## קופונים

- Route חדש: `cpn_...`.
- Route מספרי ישן: עדיין נתמך.
- Widget payload ישן: fallback ל־`id`.
- Notification link ישן: עדיין נפתח.
- Filter query ישן עם מספרים: עדיין נתמך.

## משתמשים

- Session ישן ללא `public_id`: fallback זמני למספר.
- Edge API ישן ששולח מספר: `requireSameUser()` עדיין מקבל.
- unsubscribe token ישן: עדיין מאומת ונפתר לפי `id`.
- clients חדשים מקבלים ושולחים `usr_...`.

## מתי אפשר להסיר fallback

רק לאחר שכל התנאים מתקיימים:

1. כל גרסאות mobile הישנות מחוץ לחלון התמיכה.
2. אין widgets ישנים פעילים לפי telemetry.
3. אין שימוש בנתיבים מספריים בלוגים לתקופה שהוגדרה.
4. עבר מספיק זמן לכל הודעות והמיילים הישנים.
5. tests ייעודיים מוכנים לשינוי breaking.

# אבטחה

## מה public ID כן פותר

- מונע ניחוש פשוט של הרשומה הבאה.
- לא חושף ספירת קופונים או משתמשים דרך sequence.
- מקשה enumeration של URLs.
- מפריד זהות מוצר מזהות Supabase Auth.
- מאפשר החלפת ספק Auth בלי לשנות מזהים ציבוריים.

## מה public ID לא פותר

- הוא אינו הרשאה.
- הוא אינו secret.
- מותר להעתיק אותו ללוגים ולקישורים, אך אין להסתמך על סודיותו.
- כל query עדיין חייב ownership או admin authorization.
- RLS עדיין חובה.
- Edge Functions עדיין חייבות לפתור משתמש מתוך JWT ולא לסמוך על גוף הבקשה.

## הגנות קיימות שנשמרו

- `coupon-vault` מסנן לפי `user_id` של המשתמש המאומת.
- `requireUser()` פותר משתמש מתוך Supabase JWT.
- `requireSameUser()` משווה לזהות המאומתת.
- `guard_users_public_id` מונע שינוי מזהה.
- unique indexes מונעים collisions.
- format constraints מונעים IDs לא תקינים.
- `auth_user_id` אינו נשלח כמזהה ציבורי.

# סדר עמודות ב־Postgres

Postgres אינו תומך ב־`ADD COLUMN ... AFTER id`.

עמודה חדשה מקבלת ordinal position בסוף המבנה הפיזי. שינוי סדר פיזי דורש בנייה מחדש של הטבלה, כל ה־foreign keys והתלויות. אין הצדקה לסיכון כזה עבור סדר תצוגה בלבד.

לכן:

- ב־DB העמודות החדשות נמצאות בסוף מבחינת ordinal position.
- בטיפוסי TypeScript וב־column lists הן ממוקמות מיד אחרי `id` לקריאות.
- שאילתות חייבות לבחור עמודות בשמות ולא להסתמך על `SELECT *` order.

# בדיקות קבלה

## בדיקות DB לקופונים

- count מלא מול count distinct.
- 0 null.
- 0 format violations.
- unique index קיים.
- default קיים.
- יצירה זמנית מקבלת `cpn_...`.
- קריאה חוזרת מצליחה.
- rollback משאיר 0 test rows.

## בדיקות DB למשתמשים

בזמן הפריסה נבדקו 138 משתמשים:

- 138 public IDs ייחודיים.
- 0 ערכים חסרים.
- 0 ערכים בפורמט שגוי.
- `authenticated` רשאי לקרוא את העמודה.
- immutable trigger קיים.

נוצר משתמש זמני בתוך transaction וקיבל:

```text
usr_f9f1c80b0d1848838704
```

ניסיון לשנות את ה־public ID החזיר את הערך המקורי. לאחר `ROLLBACK` נבדק שנשארו 0 משתמשי בדיקה.

## בדיקות קוד

פקודות הקבלה:

```bash
npm run typecheck
npm test -- --run
npm run check:links
git diff --check
```

בנוסף Edge Functions עוברות bundling בפריסת Supabase. כשל bundling עוצר את הפריסה ואינו מסומן כהצלחה.

## test coverage ייעודי

קיימות בדיקות עבור:

- `couponRouteId()` מעדיף public ID ושומר fallback.
- `publicUserId()` מעדיף public ID ושומר fallback ל־session ישן.
- deep-link claim files ממשיכים לקבל נתיבי `/coupons/*`.

# פריסה

## סדר פריסה מחייב

1. לפרוס migration ל־DB.
2. לוודא backfill, constraints, indexes והרשאות.
3. לפרוס Edge Functions שמבינות גם public וגם legacy IDs.
4. לפרוס web/mobile client שמתחיל לשלוח public IDs.
5. לנטר שגיאות `INVALID_INPUT`, `FORBIDDEN` ו־404.

הסדר מונע מצב שבו client חדש שולח public ID לשרת ישן.

## Edge Functions רלוונטיות

שינויי shared auth, delivery ו־unsubscribe מחייבים bundling מחדש של הפונקציות המשתמשות בהם. בין הפונקציות המרכזיות:

- `coupon-vault`
- `legacy-login`
- `manage-user-tour`
- `manage-unsubscribe`
- `update-balance`
- `trigger-multipass-update`
- `send-emails`
- `send-expiry-alerts`
- `send-engagement-alerts`
- `notify-event`
- `push-notifications`
- פונקציות נוספות שמייבאות `_shared/auth.ts`

# migration history

בפרויקט קיים פער היסטורי בין חלק מקבצי migrations המקומיים לבין טבלת migration history ב־remote.

לכן שתי המיגרציות האלו הורצו דרך `supabase db query --linked`, אומתו מול ה־DB, ואז סומנו `applied` במדויק באמצעות `supabase migration repair` עבור version שלהן בלבד.

לא בוצע repair גורף לגרסאות אחרות. אין לבצע repair אוטומטי לרשימה שלמה בלי audit נפרד.

# Rollback

## עיקרון

אין להסיר public IDs לאחר שלקוחות או מיילים התחילו להשתמש בהם. DROP מיידי ישבור קישורים קיימים.

Rollback אפליקטיבי בטוח:

1. להחזיר client לשימוש numeric fallback.
2. להשאיר עמודות ונתונים ב־DB.
3. להחזיר Edge Functions לגרסה קודמת שמקבלת numeric IDs.
4. לא למחוק unique indexes או public IDs בזמן incident.

Rollback סופי של הסכמה אפשרי רק לאחר הוכחה שאין שום consumer. ברוב המקרים אין בו צורך.

# Runbook לתקלות

## קישור קופון מחזיר 404

1. לבדוק שהמזהה תואם `^cpn_[0-9a-f]{20}$`.
2. לבדוק שקיימת שורה עם `coupon.public_id` זהה.
3. לבדוק ownership מול המשתמש המחובר.
4. לבדוק ש־`coupon-vault` בגרסה החדשה ACTIVE.
5. לבדוק אם מדובר בקישור numeric ישן; הוא אמור עדיין לעבוד.

## משתמש מחובר אך Edge Function מחזירה FORBIDDEN

1. לבדוק `users.auth_user_id = auth.uid()`.
2. לבדוק `users.public_id` קיים ותקין.
3. לבדוק שהלקוח שולח `usr_...` או legacy integer תקין.
4. לבדוק שהפונקציה נפרסה מחדש עם `_shared/auth.ts` החדש.
5. לא לפתור באמצעות service role בלקוח.

## profile query נכשל על public_id

1. לבדוק `has_column_privilege('authenticated', 'public.users', 'public_id', 'SELECT')`.
2. לבדוק RLS policy עבור השורה.
3. לבדוק ש־`USER_COLUMNS` כולל `public_id` ואינו כולל `password`.

## unsubscribe link ישן נכשל

1. לבדוק signature secret לא השתנה.
2. לבדוק שה-parser מקבל `user_id` legacy וגם `user_public_id` חדש.
3. לבדוק שהאימייל עדיין תואם לשורת המשתמש.
4. לא להדפיס token מלא ללוגים.

# כללי פיתוח עתידיים

## כשמוסיפים קישור לקופון

להשתמש ב:

```ts
couponRouteId(coupon)
```

לא להשתמש ב:

```ts
String(coupon.id)
```

## כשמוסיפים API שמקבל משתמש מהלקוח

עדיף לא לקבל user ID כלל. לפתור זהות מה־JWT.

אם הפעולה חייבת לקבל מזהה משתמש, להשתמש ב־`public_id` ולבצע authorization נפרד. לעולם לא לסמוך על עצם ידיעת המזהה.

## כשמוסיפים query ל־users

- להשתמש ב־`USER_COLUMNS` בצד client.
- לא להשתמש ב־`select('*')`.
- לא לבחור `password`.
- לכלול `public_id` אם הרשומה עוברת לשכבת מוצר.
- להשתמש ב־`id` רק ל־joins פנימיים.

## כשמוסיפים מייל או token ציבורי

- לא להכניס integer user ID ל־payload שניתן לפענוח.
- להשתמש ב־`user_public_id`.
- token חתום אינו token מוצפן.
- לשמור backward compatibility לאורך חיי המיילים הקיימים.

# סיכום

המערכת משתמשת כעת במודל dual identity:

- integer IDs נשארים יעילים ויציבים בתוך ה־DB.
- opaque public IDs משמשים בגבולות חיצוניים.
- Supabase Auth UUID נשאר מבודד בשכבת ההזדהות.
- clients ישנים ממשיכים לעבוד.
- clients חדשים אינם צריכים לחשוף sequences.
- RLS ו־ownership נשארים מקור האבטחה האמיתי.

זהו המודל המחייב לכל פיתוח חדש סביב קופונים ומשתמשים.
