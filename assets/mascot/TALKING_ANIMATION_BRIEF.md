# `talking` — בריף להפקת לופ חדש

הבעיה שדווח עליה: **"זה לא מרגיש כאילו הוא מדבר."** זה נכון, ויש לזה סיבה
מדודה ולא סובייקטיבית. המסמך הזה מחליף כל בריף קודם למצב `talking`.

---

## 1. האבחנה

`talking` ממופה לשורה 1 באטלס — `assets/mascot/3d/greeting-smooth.webp`.
עברתי על כל 36 הפריימים שלו, אחד־אחד:

| מה משתנה בין הפריימים | מה לא משתנה |
|---|---|
| היד השמאלית עולה ויורדת בנפנוף | **הפה.** אותו חיוך פתוח בדיוק, ב־36 מ־36 הפריימים |
| הגוף מתנדנד קלות | הגבות |
| — | זכוכית המגדלת ביד השנייה |

כלומר: מה שהקוד קורא לו "מדבר" הוא **נפנוף שלום**. אין ולו פריים אחד שבו הפה
בצורה אחרת. אדם שמסתכל על זה רואה דמות שמנופפת, והבועה לידה נקראת ככיתוב —
לא כדיבור. שום תיקון בקוד לא יסדר את זה, כי זה חסר בארט.

**המטרה של הבריף:** לופ `talking` חדש שבו **הפה זז**.

---

## 2. האילוץ שקובע את כל השאר

הפייפליין (`scripts/prepare-expiry-escalation.py`) לא מקבל 36 פריימים
מצוירים. הוא מקבל **6 פריימי מפתח** ומייצר את הביניים ב־optical flow.
ה־README של `assets/mascot/3d/` כותב את זה במפורש:

> *"Optical flow cannot resolve occlusion or changing eye/mouth topology
> reliably... Greeting uses the three open-mouth poses; celebration uses the
> two closed-eye poses to avoid double eyes during interpolation."*

זה אומר דבר אחד, והוא הכי חשוב במסמך הזה:

> ### הפה חייב להישאר **פתח אחד פתוח** בכל ששת הפריימים.
> הוא משנה **גודל וצורה** — צר/רחב, נמוך/גבוה — ולעולם לא נסגר לקו ולא
> מתפצל לשניים. פה שנסגר ונפתח משנה טופולוגיה, וה־optical flow ייצר ממנו
> מריחה או פה כפול.

זו בדיוק הסיבה ש־`greeting` השתמש רק בשלוש הפוזות עם הפה הפתוח. ההבדל הוא
שהפעם הפתח צריך **להשתנות** בין הפוזות, לא להישאר זהה.

---

## 3. אילו תמונות לצרף לצ'אט

| קובץ | רזולוציה | למה |
|---|---|---|
| `assets/mascot/mascot_reference_square.png` | 1024×1024 | **קנון הדמות.** כל נכס חדש נמדד מולו |
| `assets/mascot/3d/source/six-seven-keyframes.png` | 1536×1024 | **הפורמט המדויק.** גיליון 3×2 על רקע כרומה ירוק שעבר בפייפליין בהצלחה |

שתיים, לא יותר. הראשונה = איך הוא נראה. השנייה = איך הגיליון נראה.

**אל תצרף** את `greeting-smooth.webp` — זה אטלס 6×6 של 36 פריימים, והמודל
ילמד ממנו את הפריסה הלא נכונה.

---

## 4. מה בדיוק צריך לחזור

| | |
|---|---|
| קובץ | PNG יחיד |
| מידות | **1536×1024 בדיוק** — הסקריפט זורק שגיאה על כל מידה אחרת |
| פריסה | **3 עמודות × 2 שורות**, תא של 512×512 |
| סדר קריאה | שמאל־לימין, שורה עליונה ואז תחתונה (תאים 1–6) |
| רקע | **כרומה ירוק טהור**, אחיד, בלי גרדיאנט ובלי צל על הרקע |
| מצלמה | **קבועה.** אותו גודל דמות ואותו מיקום בכל שישה התאים |
| מסגור | גוף מלא, מלפנים, עם שוליים בטוחים מכל צד |
| טקסט | אין. בלי מספרים, בלי כיתוב, בלי מסגרות לתאים |

המצלמה הקבועה היא לא בקשה אסתטית — הסקריפט חותך לפי עוגן תא קבוע ולא
מרכז מחדש כל צללית, כדי שהגוף לא יקפוץ כשיד עולה.

---

## 5. ששת פריימי המפתח

לופ של מחזור דיבור אחד: פותח קטן, מתרחב להברה המוטעמת, חוזר. הפריים השישי
חייב לחזור כמעט לראשון כדי שהלופ ייסגר בלי קפיצה.

| # | פה | ראש וגבות | יד פנויה |
|---|---|---|---|
| 1 | פתח קטן, אליפסה רחבה ונמוכה | ישר, גבות רגילות | למטה, רגועה |
| 2 | בינוני, מתעגל | עולה מעט | מתחילה לעלות, כף פתוחה |
| 3 | **הכי רחב** — אליפסה גבוהה | עולה, גבות מורמות קלות | בשיא, כף פתוחה כלפי מעלה, כאילו "תראה" |
| 4 | בינוני, מתכווץ | מתחיל לרדת | מתחילה לרדת |
| 5 | קטן־בינוני | כמעט ישר | כמעט למטה |
| 6 | פתח קטן, כמו 1 | ישר | למטה — כמו 1 |

### שלושה דברים שחייבים להישמר בכל ששת התאים

1. **זכוכית המגדלת ביד השנייה.** לפי `docs/mascot/CHARACTER.md` §2 היא
   "הפרופ המגדיר" ונמצאת ביד בכל 36 הפריימים של כל לופ. לא להוריד אותה.
2. **העיניים פתוחות.** בלי מצמוץ ובלי עיניים עצומות — אותה בעיית טופולוגיה
   כמו הפה, וזו הסיבה ש`celebration` הוגבל לשתי פוזות.
3. **התנועה בין תאים שכנים קטנה.** הביניים מיוצרים מתוכם; קפיצה גדולה בין
   שני תאים תיראה כמו מריחה ולא כמו תנועה.

### מה לא לעשות

- **לא נפנוף.** זה בדיוק מה שיש היום וזה מה שנקרא "שלום" ולא "דיבור".
- **לא ויזמות אמיתיות.** לדמות יש פה זעיר; סט של 20 צורות פה לא ייקרא בגודל
  שבו הוא מוצג באפליקציה (88–176pt). שלוש דרגות פתיחה מספיקות.
- **בלי כובע, אנטנה, בגדים, צביעה מחדש, או תחפושת.** `CHARACTER.md` §3.

---

## 6. פרומפט מוכן להדבקה

> Create a production animation keyframe sheet for a mobile app mascot,
> matching the attached reference character with maximum fidelity: cobalt-blue
> rounded-square body, large white oval eyes with dark navy pupils and a white
> highlight, dark curved eyebrows, small mouth, no nose, short rounded blue
> legs, blue mitten hands, and a graphite magnifying glass with a blue-tinted
> lens held in one hand. Same soft matte 3D material and the same proportions.
> No redesign, no hat, no clothing, no recolouring.
>
> Output a single PNG, exactly 1536x1024, laid out as 3 columns by 2 rows of
> 512x512 cells, on a flat pure chroma-green background. Fixed camera: the
> character is the same size and in the same position in all six cells, full
> body, front-facing, with safe margins.
>
> The six cells are one speech cycle. The mouth is an OPEN aperture in every
> single cell and never closes to a line and never splits in two — it only
> changes size and shape. Cell 1: small wide-flat oval mouth, head level, free
> hand down. Cell 2: medium rounder mouth, head lifting slightly, free hand
> rising with an open palm. Cell 3: widest tall oval mouth, head up, eyebrows
> slightly raised, free hand at the top of a small open-palm "look at this"
> gesture. Cell 4: medium mouth contracting, head starting down, hand starting
> down. Cell 5: small-medium mouth, head nearly level, hand nearly down.
> Cell 6: same as cell 1, so the loop closes.
>
> Eyes stay open in all six cells. The magnifying glass stays in the same hand
> in all six cells. Keep the motion between neighbouring cells small. No text,
> no labels, no cell borders, no backdrop, no shadow cast onto the background.

---

## 7. מה קורה אחרי שהקובץ חוזר

1. לשמור בתור `assets/mascot/3d/source/talking-keyframes.png`.
2. צד הקוד: `prepare-expiry-escalation.py` מקובע היום לשני הגיליונות שלו
   (`escalation` ו־`relief`). צריך להרחיב אותו או להוסיף סקריפט אחות שמייצר
   `talking-smooth.webp` מגיליון בודד. זה שינוי קטן — הקיינג, ההתאמה
   והאינטרפולציה כבר כתובים ומשותפים.
3. האטלס החדש נכנס כשורה 1 ב־`MascotAnimation.tsx`, במקום `greeting-smooth`.
4. `greeting-smooth.webp` **לא נמחק.** נפנוף שלום הוא אנימציה לגיטימית
   לאונבורדינג ולהזמנות — הוא פשוט לא "מדבר". שווה לשקול להוסיף `greeting`
   כמצב משלו ב־`MascotState` ולעדכן את `STATE-LAW.md` בהתאם.
5. לבדוק על שני הרקעים דרך `preview-smooth.webp` לפני מיזוג. ה־README מזהיר
   במפורש: לעבור על פריימי הביניים לפני שליחה, כי זה בדיוק המקום שבו
   optical flow נכשל.
