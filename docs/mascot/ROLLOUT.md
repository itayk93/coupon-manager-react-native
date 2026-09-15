# תוכנית ההטמעה

ארבעה שלבים. כל שלב עומד בפני עצמו, ניתן למיזוג לבד, ומוזיל את הבא אחריו.
כל שלב הוא קומיט נפרד לפחות.

**לפני כל שלב:** `npm test && npm run typecheck`.

---

## שלב 1 — למחוק את השקר, לקבוע את השם

הקוד מצהיר היום על שתי דמויות. יש אחת. זה חייב להיסגר לפני כל דבר אחר,
אחרת כל שכבה חדשה נבנית על API כוזב.

### 1א — למחוק את ה־props המתים *(סמנטי, קטן, ערך גבוה)*

`CharacterSpotlight` דורש בטיפוס `character: "investigator" | "helper"` ומקבל
`tone`, ו**שניהם לא נקראים במימוש בכלל**. הם מועברים מ־11 ו־10 קבצים בהתאמה,
בלי שום השפעה.

| קובץ | שינוי |
|---|---|
| `src/components/onboarding/CharacterRig.tsx` | להסיר `character` ו־`tone` מהטיפוסים של `CharacterSpotlight` ו־`FloatingMascot` |
| `src/components/ui/EmptyState.tsx` | להסיר את ה־prop `mascot?: "helper" \| "investigator"` — כל תפקידו להזין את ה־prop המת. גם להסיר את הסגנון המת `visualStage` |
| 11 קבצי קריאה | להסיר `character="…"` |
| 10 קבצי קריאה | להסיר `tone="…"` |
| 3 קבצי קריאה | להסיר `mascot="…"` (`CouponsListScreen:844`, `DashboardScreen:285`, `SharingScreen:354`) |

**הגדרת סיום:** `grep -rn 'character=\|tone=\|mascot=' src --include="*.tsx"`
מחזיר אפס תוצאות לדמות. `npm run typecheck` נקי.

### 1ב — לשנות שם *(מכני, דיפ גדול, אפס שינוי התנהגות)*

קומיט נפרד, כדי שהשינוי הסמנטי של 1א יהיה קריא לבדו.

`CharacterRig.tsx` יושב ב־`components/onboarding/` אבל 13 קבצים מכל
האפליקציה מייבאים ממנו. הוא לא שייך לאונבורדינג.

| מ־ | ל־ |
|---|---|
| `src/components/onboarding/CharacterRig.tsx` | `src/components/ui/Kuponi.tsx` |
| `CharacterSpotlight` | `Kuponi` |
| `CharacterScene` | `KuponiScene` |
| `FloatingMascot` | `KuponiFloating` |
| `CharacterState` | `KuponiState` |
| `src/components/ui/MascotLoadingState.tsx` | `src/components/ui/KuponiLoading.tsx` |
| `src/components/ui/MascotSprite.tsx` | להטמיע לתוך `Kuponi.tsx` — שבע שורות שעוטפות קריאה אחת |

`MascotAnimation.tsx` נשאר בשמו: הוא נגן האטלס ברמה הנמוכה, לא הדמות.
נכסי `assets/mascot/` לא זזים — שינוי שם קבצים שובר את שלושת סקריפטי
הפייתון ואת שני העותקים הנייטיביים, ולא קונה כלום.

### 1ג — השם בטקסטים

לפי הטבלאות ב־[`VOICE.md`](VOICE.md) §4: שתי מחרוזות ההתראה, 13 מצבי
טעינה, ותווית הנגישות ב־`InviteScreen.tsx:78`.

**הגדרת סיום:** `grep -rn "מאסקוט\|מאסקט" src supabase` לא מחזיר טקסט
שמשתמש נחשף אליו.

---

## שלב 2 — `SpeechBubble` יוצא מהאונבורדינג

קופוני מדבר היום במסך אחד בלבד. הקומפוננטה כבר כתובה
(`OnboardingScreen.tsx:272`) ו־`CouponAccessHero` כבר הוכיח שהתבנית עובדת
מחוץ לאונבורדינג.

1. להוציא את `SpeechBubble` ל־`src/components/ui/SpeechBubble.tsx` בלי שינוי
   התנהגות. `OnboardingScreen` מייבא במקום להגדיר.
2. `EmptyState` — הכותרת עוברת לבועה. מסך ריק הוא בדיוק הרגע שבו צריך
   שמישהו יסביר מה קורה.
3. `KuponiLoading` — כנ"ל.

**הגדרת סיום:** `SpeechBubble` מיוצא ממקום אחד, שלושה צרכנים, והאונבורדינג
נראה זהה לחלוטין.

---

## שלב 3 — אכיפת החוק

הרשימה המלאה של ההפרות: [`STATE-LAW.md`](STATE-LAW.md) §5.

| קובץ | מ־ | ל־ |
|---|---|---|
| `ui/MascotLoadingState.tsx:32` | `thinking` | `calm` |
| `ui/EmptyState.tsx:47` | `thinking` | `talking` |
| `coupons/CouponBarcodeView.tsx:135-140` | `scanning` | **להסיר.** הקופאי סורק, לא קופוני |
| `referral/ReferralProgramScreen.tsx:161` | `cheering` | `talking` |
| `admin/NewslettersTab.tsx:87` | `MascotLoadingState` | spinner |
| `admin/GeoAnalyticsTab.tsx:44` | `MascotLoadingState` | spinner |
| `admin/ReferralsTab.tsx:167,280` | `MascotLoadingState` | spinner |

בנוסף: להוציא משימוש את `anxious` / `panic` / `emergency` בקוד חדש. הם
מתמפים לאותה שורת אטלס כמו `concerned` ומבטיחים דירוג שלא קיים. עוצמה
נשלטת דרך `expiryEmphasis`, לא דרך שם המצב.

**הגדרת סיום:** כל אתרי הקריאה מסווגים ✅ ב־`STATE-LAW.md` §5.

---

## שלב 4 — החגיגות לתוך האפליקציה

> **תיקון להערכה הראשונית.** נאמר קודם שהווידג'ט הנייטיבי לא יודע להציג את
> C1–C10 ושזו העבודה שנותרה. **זה לא נכון.** הצינור שלם מקצה לקצה:
> `widgetSync.ts:296` → `WidgetPayload` → `CouponWidget.swift:592-606`
> ו־`CouponWidgetProvider.kt:83-87`. הערת הסטטוס בבריף
> `WIDGET_MASCOT_CELEBRATION_STATES.md` מיושנת, והיא מה שהטעה אותי.

הפער האמיתי אחר, והוא גדול יותר: **`pickCelebration` נקרא ממקום אחד בלבד —
`widgetSync.ts`.** עשר סצנות חגיגה הופקו, נבדקו על מכשיר, וחוברו — ומשתמש
שלא התקין את הווידג'ט לא יראה אף אחת מהן. אי פעם.

העבודה:

1. הסצנה שנבחרה כבר נשמרת מקומית ב־`celebrationMemory.ts` — קריאה מהאפליקציה
   לא דורשת סנכרון חדש, רק צרכן שני.
2. להציג אותה בבית. `SixSevenCelebration.tsx` הוא כבר בדיוק התבנית הנכונה:
   באנר נדחה, נעלם בחצות מקומית, לא מחליף את מצבי הטעינה או ההצלחה הרגילים.
3. הנכסים כבר בריפו כ־PNG ריבועיים — `assets/mascot/celebration/`. לא דרוש ארט.

**לא נכנס:** `streak` / C5. מודד פתיחות אפליקציה, לא כסף. ראה
[`INVENTORY.md`](INVENTORY.md) §4.

**מועמד סביר לאחר כך:** `referral` / C8 — הנייטיב כבר מטפל, JS לא פולט,
והצטרפות חבר היא אירוע אמיתי.

**הגדרת סיום:** משתמש בלי ווידג'ט מותקן רואה חגיגה כשהוא חוצה אבן דרך.

---

## מה לא נכנס לאף שלב

| | למה |
|---|---|
| streaks, XP, לבבות | פתיחה יומית אינה המוצר. ראה `README.md` |
| תחפושות, כובעים, גרסאות עונתיות | `CHARACTER.md` §3 |
| אטלס הסלמה חדש (4 דרגות דאגה אמיתיות) | אולי מוצדק. דורש הפקת ארט, לא חלק מהניקיון |
| שינוי שם קבצי הנכסים | שובר את סקריפטי הפייתון ואת שני העותקים הנייטיביים |
| ניקוי 20 הנכסים המיושנים | `INVENTORY.md` §6. ניקיון נכסים ושינוי קוד לא באותו קומיט |
