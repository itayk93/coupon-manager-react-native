# באדג'ים לאבני הדרך — בריף הפקה

שנים־עשר באדג'ים, אחד לכל שלב בשני הסולמות של `src/lib/celebrationTrigger.ts`
(`COUNT_STEPS`, `SAVINGS_STEPS`). **כולם הופקו והם בפנים.** נפילה חזרה לסצנת
הסולם (`C2-coupon-milestone` / `C3-lifetime-savings`) נשארה בקוד עבור שלב
שיתווסף לסולם בעתיד ועוד אין לו אמנות.

פתוח: `savings-10000` הוא עדיין חזיר גנרי. החלופה המאושרת היא קופסת חיסכון
בצללית של הדמות — בלי פנים, בלי עיניים, בלי גפיים — שהיא חפץ בעולם שלו ולא
וריאציה שלו, מה ש-`docs/mascot/CHARACTER.md` §3 אוסר. שורת הנושא לה נמצאת
בפרומפטים למטה.

## אלה אובייקטים, לא הדמות

הדמות לא מופיעה בבאדג'ים. `docs/mascot/CHARACTER.md` §3 אוסר תחפושות,
וריאציות וצביעה מחדש, ושנים־עשר פוזות חדשות הן שנים־עשר הזדמנויות לשבור את
הקאנון בלי לשים לב. הבאדג' הוא הפרס — ערימת כרטיסים, מטבעות, כספת — באותו
חומר ובאותה תאורה שהדמות עשויה מהם. קופוני עצמו כבר נמצא בראש העמוד.

## מה לצרף לכלי התמונה

| קובץ | למה |
|---|---|
| `assets/mascot/mascot_reference_square.png` | קאנון החומר, התאורה והפרופורציות |
| `assets/mascot/celebration/app/C2-coupon-milestone.webp` | כרטיסי קופון בזהב, בתאורה של המערכת |
| `assets/mascot/celebration/app/C3-lifetime-savings.webp` | מטבעות וכספת, אותה תאורה |

## פלט

`assets/mascot/milestones/`, ריבוע 1024×1024, WebP או PNG.

רקע שקוף מועדף. אם הכלי לא יודע — רקע שטוח ואחיד `#e8f2fd`, בלי צל נופל על
הרקע, והוא ייחתך כאן.

| קובץ | השלב |
|---|---|
| `coupons-5.webp` | 5 קופונים |
| `coupons-10.webp` | 10 קופונים |
| `coupons-25.webp` | 25 קופונים |
| `coupons-50.webp` | 50 קופונים |
| `coupons-100.webp` | 100 קופונים |
| `coupons-250.webp` | 250 קופונים |
| `savings-1000.webp` | ₪1,000 |
| `savings-5000.webp` | ₪5,000 |
| `savings-10000.webp` | ₪10,000 |
| `savings-25000.webp` | ₪25,000 |
| `savings-50000.webp` | ₪50,000 |
| `savings-100000.webp` | ₪100,000 |

## הפרומפטים

הבסיס חוזר בכל אחד; משתנה רק שורת הנושא.

```
BASE (prepend to every prompt):
3D rendered achievement badge, single centered object, no character, no text,
no numerals, no logos. Soft matte plastic material with gentle subsurface
glow, rounded toy-like forms, no sharp corners. Studio three-point lighting
with a soft blue rim light from the upper left and a warm gold bounce from
below. Crisp edges, no banding. Square 1024x1024, transparent background.
Palette: cobalt blue #1f6fd1, deep navy #154a8f, pale blue #5b9bd8, warm gold
#f5b429 for metal and accents only.

CAMERA — identical on every badge in the set: three-quarter view from slightly
above, roughly 25 degrees, object facing the viewer, no top-down and no
straight-on elevation.

BASE PLINTH — on every badge without exception: the object rests on the same
rounded cobalt-blue pedestal disc with a thin warm-gold rim around its top
edge. The plinth is the same size and material every time; only what stands on
it changes. This is what makes twelve separate generations read as one set.

The object must look like it belongs in the same universe as a rounded
cobalt-blue blob mascot made of the same matte plastic — friendly and tactile,
never corporate, never photoreal, never flat vector.

 1. coupons-5      — five glossy blue coupon tickets with rounded corners and a notched edge, fanned in a shallow arc
 2. coupons-10     — ten blue coupon tickets in two neat leaning rows, a single gold ticket among them
 3. coupons-25     — a tidy stack of blue coupon tickets bound with a thin gold ribbon tied in a small bow
 4. coupons-50     — a tall confident stack of blue coupon tickets, slightly fanned, one gold ticket standing upright on top
 5. coupons-100    — an open rounded chest overflowing with blue coupon tickets, warm gold light spilling from inside
 6. coupons-250    — a monumental tower of blue coupon tickets, a gold laurel wreath resting around its foot
 7. savings-1000   — three thick gold coins leaning against each other
 8. savings-5000   — a neat pile of gold coins
 9. savings-10000  — a rounded-square cobalt-blue money box in the mascot's own silhouette, no face, no eyes, no limbs, furniture and not a creature, a warm gold coin slot across the top and a thin gold trim line, one gold coin dropping into the slot, a small pile of gold coins beside it
10. savings-25000  — a rounded treasure chest half full of gold coins, lid open, blue body with gold fittings
11. savings-50000  — a treasure chest overflowing with gold coins, a gold key resting against it
12. savings-100000 — a rounded blue vault door standing open, warm gold light pouring out, coins spilling across the threshold
```

## למה המצלמה והבסיס נוספו

הראשון (`coupons-5`) חזר בשלושת־רבעי מלמעלה, עם עומק ועם פודיום כחול מכותרת
זהב. השני (`coupons-10`) חזר כמעט חזיתי, שטוח יותר, בלי בסיס — נכון לפרומפט
שלו, ולא אח של הראשון. הפרומפט לא אמר זווית ולא אמר בסיס, אז כל הפקה בחרה
לעצמה. שתי הפסקאות האלה הן התיקון, והפודיום של הראשון הוא מה שנבחר כחתימה של
הסדרה.

## כשהם מגיעים

הקובץ שהכלי מחזיר נכנס כמו שהוא ל-`assets/mascot/milestones/source/`, בשם
מהטבלה, ואז `npm run milestone-badges` (או
`python3 scripts/build-milestone-badges.py`). הסקריפט חותך לפי האלפא ומרכז
בריבוע 512 עם אותו שוליים לכולם — כלי תמונה ממסגר כל באדג' אחרת, והראשון חזר
1254 רוחב עם האובייקט גבוה וכמעט מקצה לקצה, אז בלי הנרמול הזה כל באדג' בשביל
היה מופיע בגודל אחר.

## איפה הם מופיעים

הם נכנסים ל-`assets/mascot/milestones/` בשמות שלמעלה, ו-`MilestonesScreen`
מחליף את `LADDER_SCENE` במפה לפי שלב. שלב בלי קובץ ממשיך ליפול חזרה על סצנת
הסולם, כך שאפשר להוסיף אותם בזה אחר זה.
