# מצאי נכסי קופוני

87 קבצים פזורים בשמונה תיקיות, בלי מסמך שאומר איזה מהם קנוני. זו הסיבה שכל
תוספת חדשה הייתה החלטה מאפס. הטבלאות כאן ממפות את כולם.

**מקרא:** 🟢 קנוני · 🔵 נגזר אוטומטית · ⚪ מיושן · 🟠 לא מחובר

---

## 1. המקור

| קובץ | סטטוס | הערה |
|---|---|---|
| `assets/mascot/original_app_mascot.png` | 🟢 | **הרפרנס.** כל נכס חדש מושווה אליו. האינווריאנטים ב־`CHARACTER.md` §3 |
| `assets/mascot/mascot_reference_square.png` | 🟢 | חיתוך ריבועי של אותו רפרנס, לבריפים |

---

## 2. אטלסי האנימציה — בתוך האפליקציה

`assets/mascot/3d/` · 36 פריימים ברשת 6×6 · 24fps · לופ של 1.5 שניות

| קובץ | שורה באטלס | מצבים | סטטוס |
|---|---|---|---|
| `scan-smooth.webp` | 0 | `scanning`, `thinking`, `calm` | 🟢 |
| `greeting-smooth.webp` | 1 | `talking` | 🟢 |
| `success-smooth.webp` | 2 | `cheering`, `success` | 🟢 |
| `concern-smooth.webp` | 3 | `concerned`, `anxious`, `panic`, `emergency` | 🟢 |
| `six-seven-smooth.webp` | 4 | `six-seven` | 🟢 |
| `preview-smooth.webp` | — | תצוגת בדיקה, רקע בהיר וכהה | 🔵 |
| `preview.webp` | — | טיוטה ישנה | ⚪ |
| `mascot-atlas.png` | — | פריימי המפתח המאושרים, לשחזור | 🟢 |
| `intermediate-proof.png` | — | הוכחת האינטרפולציה | 🔵 |
| `3d/source/` | — | קלט להפקה מחדש | 🟢 |

הצרכן היחיד: `src/components/ui/MascotAnimation.tsx`.

> **פער מתועד:** שורה 3 משרתת ארבעה שמות מצב, כלומר `anxious`, `panic` ו־
> `emergency` הם אותה אנימציה בדיוק. ראה `STATE-LAW.md` §4.

---

## 3. סדרת התפוגה — הווידג'ט

תשע דרגות הסלמה אמיתיות, מ־8+ ימים עד "היום".

| מיקום | קבצים | סטטוס |
|---|---|---|
| `assets/mascot/widget-originals/MascotState1..9.png` | 9 | 🟢 המקור |
| `assets/mascot/widget-originals/superseded/*_pre-2026-09-10.png` | 8 | ⚪ סבב קודם, נשמר להשוואה |
| `assets/mascot/adapted-widget-states/*.png` | 8 | 🔵 שמות עבריים (`היום`, `מחר`, `יומיים`, `3–7 ימים`) |
| `targets/widget/Assets.xcassets/MascotState1..9.imageset/` | 9 | 🔵 עותק iOS |
| `modules/coupon-widget/android/.../drawable-nodpi/mascot_scene_0..7.webp` | 8 | 🔵 עותק אנדרואיד |

בריפי ההפקה: `WIDGET_MASCOT_IMAGE_BRIEF.md`, `WIDGET_MASCOT_REDO_2-3-4-8.md`,
`WIDGET_SPECS.md`.

---

## 4. סצנות החגיגה

`assets/mascot/celebration/` · פלטה חמה, מצלמה קרובה — ההפך מסדרת התפוגה.

| קובץ | הטריגר | ב־`CelebrationKind` | סטטוס |
|---|---|---|---|
| `C1-anniversary.png` | `memberSinceDays` חוצה 30/180/365/730 | `anniversary` | 🟢 |
| `C2-coupon-milestone.png` | ספירת קופונים חוצה 5/10/25/50/100/250 | `milestone` | 🟢 |
| `C3-lifetime-savings.png` | חיסכון מצטבר חוצה 1K…100K | `savings`, `redeemed` | 🟢 |
| `C4-monthly-recap.png` | סיכום חיסכון חודשי | `monthly` | 🟢 |
| `C4-monthly-recap-alt.png` | גרסה חלופית | — | 🟠 לא בשימוש |
| `C5-usage-streak.png` | רצף שימוש | **אין** | 🟠 ראה למטה |
| `C6-last-minute-rescue.png` | קופון נוצל בטווח התפוגה | `rescue` | 🟢 |
| `C7-clean-month.png` | חודש בלי תפוגה מבוזבזת | `clean` | 🟢 |
| `C8-referral-joined.png` | חבר הצטרף | `referral` | 🟠 לא נפלט מ־JS |
| `C9-wallet-record.png` | שיא ארנק חדש | `record` | 🟢 |
| `C10-six-seven.png` | 67 קופונים בדיוק | `six-seven` | 🟢 |

עותקים נייטיביים: `targets/widget/Assets.xcassets/MascotCelebrationC1..C9` +
`MascotCelebration67`, ו־`drawable-nodpi/celebration_c1..c9.webp` +
`celebration_67.webp`.

### C5 — ארט מת, ובכוונה

`CouponWidget.swift:601` ו־`CouponWidgetProvider.kt` שניהם מטפלים ב־
`"streak"`, אבל `CelebrationKind` ב־`src/lib/celebrationTrigger.ts` **לא
מכיל אותו**, ולכן JS לעולם לא פולט אותו. הצינור מחובר ורק הקצה שלו סתום.

זה הפער הנכון. רצף שימוש מודד *פתיחות אפליקציה*, לא כסף — ראה `README.md`,
"מה זה לא". C5 נשאר בריפו כארט שהופק, ולא מחובר.

C8 (`referral`) במצב זהה: הנייטיב מטפל, JS לא פולט. זה כן שווה חיבור בעתיד,
כי הצטרפות חבר היא אירוע אמיתי.

---

## 5. תוספות השיתוף של iOS

`targets/add-share/` ו־`targets/share/` · אנימציה נייטיבית, מגיבה ל־Reduce Motion

| imageset | תוכן | סטטוס |
|---|---|---|
| `Mascot.imageset` | תמונה סטטית, `@1x/@2x/@3x` | 🟢 |
| `MascotScan.imageset/atlas.png` | עותק של `scan-smooth` | 🔵 |
| `MascotSuccess.imageset/atlas.png` | עותק של `success-smooth` | 🔵 |
| `MascotAtlas.imageset/mascot-atlas.png` | פריימי המפתח | 🔵 |

---

## 6. נכסים רופפים בשורש `assets/mascot/`

35 קבצים. רובם קלט או פלט ביניים של הפקות שכבר הסתיימו:

| קבוצה | קבצים | סטטוס |
|---|---|---|
| `mascot_state_1..5_*.png` + `.jpg` | 10 | ⚪ קדם־ווידג'ט. הוחלפו ב־`widget-originals/` |
| `mascot_idle_spritesheet.*`, `mascot_run_spritesheet.*` | 4 | ⚪ ספרייטשיטים דו־ממדיים, קדם־תלת־ממד. לא בשימוש |
| `widget_scene_1..5.png` | 5 | ⚪ סבב מוקדם |
| `*.png` בשמות עבריים (`היום`, `מחר`, `3 ימים`…) | 11 | 🔵 כפילות של `adapted-widget-states/` |
| `sharing-offer-sprite.webp` | 1 | 🟢 `MascotSprite`, מסך שיתופים |

**להסרה בניקיון עתידי** (לא בשלב 1 — ניקיון נכסים ושינוי קוד לא מתערבבים
באותו קומיט): הזוגות `.jpg`/`.png` הכפולים, הספרייטשיטים הדו־ממדיים,
ו־`widget_scene_*`.

---

## 7. סקריפטי ההפקה

`scripts/` · דורשים Pillow, numpy, opencv-python

| סקריפט | מה עושה |
|---|---|
| `prepare-mascot-3d.py` | מסיר רקע ניטרלי, שומר נצנוצי פנים, מיישר חיתוכים, מייצר את אטלס פריימי המפתח |
| `interpolate-mascot-3d.py` | אינטרפולציה דו־כיוונית ל־36 פריימים, מייצר את האטלסים החלקים, ההוכחה, התצוגה והעותקים הנייטיביים |
| `prepare-six-seven.py` | מסיר ירוק כרומה, מייצר את לופ 6־7 בעיוות זרועות רציף |

ההרצה: `prepare-mascot-3d.py` ואז `interpolate-mascot-3d.py`.

---

## 8. הבריפים הקיימים

נשארים ב־`assets/mascot/` — הם מסמכי ייצור לכלי תמונה, לא מסמכי מוצר.

| בריף | נושא | תוקף |
|---|---|---|
| `WIDGET_SPECS.md` | מפרט 1:1 full‑bleed | תקף |
| `WIDGET_MASCOT_IMAGE_BRIEF.md` | תשע סצנות התפוגה | הופק |
| `WIDGET_MASCOT_REDO_2-3-4-8.md` | תיקון States 2,3,4,8 | הופק |
| `CELEBRATION_REDO_BRIEF.md` | תיקון סצנות החגיגה | הופק |
| `WIDGET_MASCOT_CELEBRATION_STATES.md` | C1–C10 | הופק. **הערת הסטטוס שבתוכו מיושנת** — ראה למטה |

> ⚠️ `WIDGET_MASCOT_CELEBRATION_STATES.md` כותב "הווידג'ט הנייטיבי עדיין לא
> יודע להציג אותן". זה **כבר לא נכון**: `CouponWidget.swift:592-606`,
> `CouponWidgetProvider.kt:83-87` ו־`widgetSync.ts:296` מחברים את הצינור
> מקצה לקצה. העבודה נעשתה אחרי שהבריף נכתב.
