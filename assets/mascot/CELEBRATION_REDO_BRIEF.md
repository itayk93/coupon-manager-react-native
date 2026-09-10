# תיקון סצנות החגיגה — בריף ממוקד

הופקו 9 סצנות חגיגה. הן נבדקו על מכשיר אמיתי. **רובן נכשלות באותן שתי בעיות.**
המסמך הזה מחליף כל בריף קודם לסצנות האלה.

---

## אילו תמונות לצרף לצ'אט

### קבוע — לצרף בכל הודעה, בלי יוצא מן הכלל

| קובץ | רזולוציה | למה דווקא הוא |
|---|---|---|
| `assets/mascot/mascot_reference_square.png` | 1024×1024 | **קנון הדמות.** הדמות מבודדת על רקע כהה, גוף מלא, מלפנים — הצללית נקראת מושלם. חתוך לריבוע מ-`original_app_mascot.png` |
| `assets/mascot/celebration/C7-clean-month.png` | 1254×1254 | **גוף מלא בעמידה** בסגנון הרינדור הנוכחי. רגליים, ידיים ופנים גלויים על רקע נקי |
| `assets/mascot/celebration/C5-usage-streak.png` | 1254×1254 | **זווית שנייה** — רגליים מפוסקות, הצללית ברורה מול רקע בהיר |
| `assets/mascot/celebration/C3-lifetime-savings.png` | 1254×1254 | **הקומפוזיציה היחידה שעברה.** ככה אזור ה-40% צריך להיראות |

שלוש הראשונות = צורת הדמות. הרביעית = הקומפוזיציה.
**כל הארבע ריבועיות 1:1** — כדי שהמודל לא ילמד יחס אחר.

לא להשתמש ב:
- `widget-originals/MascotState1.png` — 600×600 בלבד, רך מדי לשחזור הצללית
- `original_app_mascot.png` — 1536×1024, לא ריבוע. השתמש בגרסה החתוכה במקום

### לפי סצנה — לצרף גם את התמונה הכושלת שמתקנים

תגיד לצ'אט: "זו הגרסה הקודמת, תקן אותה לפי המסמך".

| סצנה | קובץ לצרף |
|---|---|
| 1. יום שנה | `assets/mascot/celebration/C1-anniversary.png` |
| 2. אבן דרך | `assets/mascot/celebration/C2-coupon-milestone.png` |
| 3. חיסכון מצטבר | — תקין, לא מפיקים מחדש |
| 4. סיכום חודשי | `assets/mascot/celebration/C4-monthly-recap.png` |
| 5. רצף שימוש | `assets/mascot/celebration/C5-usage-streak.png` |
| 6. הצלה ברגע | `assets/mascot/celebration/C6-last-minute-rescue.png` |
| 7. חודש נקי | `assets/mascot/celebration/C7-clean-month.png` |
| 8. חבר הצטרף | `assets/mascot/celebration/C8-referral-joined.png` |
| 9. שיא ארנק | `assets/mascot/celebration/C9-wallet-record.png` |

סה"כ בכל הודעה: **3 קבועות + 1 של הסצנה = 4 תמונות.**

---

## שתי הבעיות שחוזרות בכל תמונה

### בעיה 1 — האובייקט מתנגש בכותרת

הווידג'ט מצייר **שתי שכבות טקסט לבן מעל התמונה**:

```
+------------------------------------------+  ← 0%
|                                          |
|   ~8%   לוגו COUPON⬥MASTER (רוחב מלא)     |
|                                          |
|   ~15-25%   כותרת עברית, אות גדולה,       |
|             לפעמים שתי שורות              |
|                                          |
+------------------------------------------+  ← 40%  ← קו אדום
|                                          |
|          כאן מתחיל התוכן החזותי           |
|                                          |
+------------------------------------------+
```

מה קרה בפועל:

| סצנה | מה התנגש |
|---|---|
| יום שנה | **קצה כובע המסיבה + הפונפון הזהוב** נחתו באמצע "שנה איתנו!" |
| אבן דרך | **הגביע** חוצה את הכותרת ואת הלוגו |
| סיכום חודשי | **ראש המאסקט + הלבבות** נכנסים לטקסט |
| רצף שימוש | **הלהבה** עולה דרך הכותרת |
| הצלה ברגע | **הכרטיס הזהוב** יושב על "הצלה ברגע האחרון" |
| חיסכון מצטבר | ✅ **תקין** — זו התמונה היחידה שעברה. תשתמש בה כרפרנס |

**החוק החדש: 40% העליונים ריקים לגמרי.**
לא רק "כהים" — **ריקים**. שום דבר לא נכנס לשם:
לא ראש, לא יד מורמת, לא כובע, לא גביע, לא להבה, לא כרטיס, לא בלון, לא לב מרחף.
רק רקע/שמיים/קיר כהה ואחיד.

איך משיגים את זה:
- **המאסקט מתחיל מתחת לקו ה-40%.** קודקוד הראש בערך ב-42%.
- כל אובייקט שהדמות מחזיקה — **מוחזק לצד הגוף או ברמת החזה, לא מעל הראש.**
- אפקטים גדולים (להבה, פיצוץ אור, זוהר) — **מאחורי הגוף בלבד**, לא מעליו.
- קונפטי וניצוצות ב-40% העליונים: מותר רק אם הם זעירים ומטושטשים מאוד.

### בעיה 2 — צורת הדמות משתנה

ב"סיכום חודשי" וב"הצלה ברגע" המאסקט הופק **עגול/ביצתי** במקום הצורה הנכונה.
זו לא אותה דמות. זה שובר את העקביות מול 9 סצנות התפוגה שכבר באפליקציה.

**הצורה הנכונה:** מלבן מעוגל רך / "שעועית" — **רחב יותר מגובה בחלק התחתון,
עם קודקוד שטוח-מעוגל למעלה**. לא כדור. לא ביצה. לא טיפה.

הרפרנס המחייב: `assets/mascot/widget-originals/MascotState1.png`
ו-`assets/mascot/celebration/C3-lifetime-savings.png`.
**תמיד לצרף את שניהם לכל בקשת הפקה.**

---

## תנ"ך הדמות (לא משתנה לעולם)

- גוף אחד, בלי צוואר. **מלבן מעוגל רך**, לא עיגול.
- כחול מלכותי רווי, עור מאט ויניל.
- עיניים עגולות גדולות, לובן לבן, אישון שחור, נצנוץ לבן אחד.
- שתי גבות שחורות קצרות ועבות. אין אף.
- ידיים: גדמים כחולים קצרים, כף עגלגלה עם 3-4 אצבעות נוב.
- רגליים: שתי כפות עגלגלות קטנות.
- אור הרקע נשפך על העור הכחול כ-rim light.

---

## מפרט טכני

| פרמטר | ערך |
|---|---|
| יחס | 1:1 ריבוע |
| רזולוציה | 1024×1024 |
| פורמט | PNG, בלי שקיפות, full-bleed |
| סגנון | 3D Pixar/Octane, תאורה קולנועית |
| **טקסט בתמונה** | **אפס.** לא מילים, לא מספרים, לא סמלי מטבע, לא שלטים עם כיתוב |
| **40% עליונים** | ריקים, כהים, אחידים |

הערה: בסצנת "סיכום חודשי" הקודמת היה שלט באנגלית ("Small Steps Big Savings")
וספרים עם כיתוב. **אסור.**

---

## הסצנות לתיקון

לכל אחת: מה הבעיה, ומה הפרומפט המתוקן.

### 1. יום שנה
**בעיה:** כובע המסיבה נכנס לכותרת.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render. The cute chubby royal-blue mascot from the reference images — keep the character IDENTICAL: one soft ROUNDED-RECTANGLE body (wider at the bottom, flat-rounded top — NOT a circle, NOT an egg), no neck, matte vinyl skin, large round eyes with white sclera and black pupils and one white glint, two short thick black eyebrows, no nose, short nub arms with rounded hands, two small oval feet. COMPOSITION IS CRITICAL: the ENTIRE top 40% of the frame must be completely EMPTY — nothing at all in it, just dark plain dusk sky, reserved for UI text. The top of the mascot's head starts at about 42% down the frame. The mascot wears a SMALL party hat tilted sideways so it stays well below the top 40%. Arms are held out at chest height in celebration, NOT raised above the head. A birthday cake with candles sits beside it at floor level. Wrapped presents and balloons are LOW, none rising into the top 40%. Falling confetti only in the lower two thirds. Warm golden party light, gold rim light on the blue skin. No text, no numbers, no logos, no border.
```

### 2. אבן דרך (כמות קופונים)
**בעיה:** הגביע חוצה את הכותרת ואת הלוגו.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, the same identical royal-blue mascot as the reference — one soft ROUNDED-RECTANGLE body, NOT a circle or an egg. COMPOSITION IS CRITICAL: the ENTIRE top 40% of the frame must be completely EMPTY, just a dark plain stage background, reserved for UI text. The top of the mascot's head starts at about 42% down. It stands on a low podium and holds a gold trophy DOWN AT CHEST HEIGHT, hugged against its body — the trophy must NOT be lifted above the head and must NOT enter the top 40%. Proud broad smile, sparkling eyes. Spotlight glow and gold confetti only in the lower two thirds. Dark navy above, gold rim light on the blue skin. No text, no numbers, no logos, no border.
```

### 3. חיסכון מצטבר
**✅ תקין. לא לגעת.** `assets/mascot/celebration/C3-lifetime-savings.png` הוא הרפרנס לקומפוזיציה.

### 4. סיכום חודשי
**בעיות:** ראש ולבבות בכותרת · הדמות הופקה עגולה · טקסט אנגלית ברקע.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, the same identical royal-blue mascot as the reference — one soft ROUNDED-RECTANGLE body, wider at the bottom with a flat-rounded top, NOT a circle, NOT an egg, NOT a teardrop. Match the reference silhouette exactly. COMPOSITION IS CRITICAL: the ENTIRE top 40% of the frame must be completely EMPTY — a plain dark wall, nothing in it, reserved for UI text. The top of the mascot's head starts at about 42% down. It sits on a desk hugging a pink piggy bank, warm happy smile. NO floating hearts, NO objects above the mascot. Gold coins in small stacks on the desk beside it. Warm evening lamp light from the side. ABSOLUTELY NO TEXT ANYWHERE — no signs, no framed quotes, no labelled books, no currency symbols on the coins. Teal and gold rim light on the blue skin. No border, no white floor.
```

### 5. רצף שימוש
**בעיות:** הלהבה עולה דרך הכותרת · התוכן לא ברור.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, the same identical royal-blue mascot as the reference — one soft ROUNDED-RECTANGLE body, NOT a circle. COMPOSITION IS CRITICAL: the ENTIRE top 40% of the frame must be completely EMPTY, plain dark navy, reserved for UI text. The top of the mascot's head starts at about 42% down. It stands confidently with one fist raised only to SHOULDER height (never above the head). A warm glowing flame burns BEHIND and BESIDE the body, its tip staying below the top 40% — the flame must not rise past the mascot's head. A row of softly glowing check marks sits low behind it, at waist level. Confident half-smile, one eyebrow raised. Celebratory warm orange, NOT panic red. Orange rim light on the blue skin. No text, no numbers, no logos, no border.
```

### 6. הצלה ברגע האחרון
**בעיות:** הכרטיס יושב על הכותרת · הדמות הופקה עגולה · המושג לא ברור.

הרעיון: המשתמש מימש קופון יום לפני שפג. המאסקט תופס אותו לפני שהוא נעלם.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, the same identical royal-blue mascot as the reference — one soft ROUNDED-RECTANGLE body, wider at the bottom with a flat-rounded top, NOT a circle, NOT an egg. Match the reference silhouette exactly. It wears a small red superhero cape. COMPOSITION IS CRITICAL: the ENTIRE top 40% of the frame must be completely EMPTY — plain bright sky, nothing in it, reserved for UI text. The top of the mascot's head starts at about 42% down. The mascot flies forward horizontally, low in the frame, clutching a glowing golden gift card AGAINST ITS CHEST with both hands — the card must NOT be held up and must NOT enter the top 40%. Determined winning smile. Soft clouds and a warm light burst only in the lower two thirds. Cool sky rim light on the blue skin. No text, no numbers, no logos, no border.
```

### 7. חודש נקי
**לבדוק:** אם הוי הזוהר נכנס ל-40% העליונים — להנמיך אותו.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, the same identical royal-blue mascot as the reference — one soft ROUNDED-RECTANGLE body, NOT a circle. COMPOSITION IS CRITICAL: the ENTIRE top 40% of the frame must be completely EMPTY, plain dark teal, reserved for UI text. The top of the mascot's head starts at about 42% down. It stands calmly holding a gold medal at chest height and giving a thumbs up. A large softly glowing check mark sits BEHIND it, low, its top staying below the top 40%. Quiet satisfied smile, soft eyes. Gold confetti only in the lower two thirds. Teal and gold rim light on the blue skin. No text, no numbers, no logos, no border.
```

### 8. חבר הצטרף
**לבדוק:** הידיים המורמות בכיף נכנסות לכותרת.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render. TWO mascots identical to the reference — one royal-blue and one slightly smaller lighter-blue, both with the same soft ROUNDED-RECTANGLE body, NOT circles. COMPOSITION IS CRITICAL: the ENTIRE top 40% of the frame must be completely EMPTY, plain dark background, reserved for UI text. The tops of both heads start at about 42% down. They clasp hands BETWEEN them at chest height — a low handshake or fist bump, NOT a raised high-five, nothing above the heads. Both laughing with happy eyes. A small spark burst where their hands meet, gold and blue confetti only in the lower two thirds. Gold rim light on the blue skin. No text, no numbers, no logos, no border.
```

### 9. שיא ארנק
**לבדוק:** הדגל כנראה נכנס לכותרת.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, the same identical royal-blue mascot as the reference — one soft ROUNDED-RECTANGLE body, NOT a circle. COMPOSITION IS CRITICAL: the ENTIRE top 40% of the frame must be completely EMPTY — plain dark pre-dawn sky, nothing in it, reserved for UI text. The top of the mascot's head starts at about 42% down. It stands on a rocky peak holding a small gold flag LOW, angled down and sideways at hip height — the flag must NOT be planted upright and must NOT enter the top 40%. Proud broad smile. A glowing bar chart blending into mountains sits low behind, its tallest bar staying below the top 40%. Sunrise light along the horizon only. Warm rim light on the blue skin. No text, no numbers, no chart labels, no logos, no border.
```

---

## צ'קליסט קבלה — לעבור עליו על כל תמונה

- [ ] שמים סרגל על 40% העליונים — **ריק לחלוטין**? בלי ראש, יד, כובע, גביע, להבה, כרטיס, דגל, בלון, לב.
- [ ] הצללית של הדמות = **מלבן מעוגל**, רחב בתחתית. לא עיגול, לא ביצה, לא טיפה.
- [ ] אפס טקסט/מספרים/סמלי מטבע/כיתוב על שלטים או ספרים.
- [ ] 1:1, 1024×1024, PNG בלי שקיפות, full-bleed, בלי מסגרת ובלי רצפה לבנה.
- [ ] הדמות זהה ל-`MascotState1.png` ול-`C3-lifetime-savings.png`.

---

## פרומפט פתיחה לצ'אט

```text
מצורף המסמך CELEBRATION_REDO_BRIEF.md וארבע תמונות ייחוס קבועות:
- mascot_reference_square.png — קנון הדמות, ריבוע
- C7-clean-month.png — גוף מלא בעמידה בסגנון הנוכחי
- C5-usage-streak.png — זווית שנייה, רגליים מפוסקות
- C3-lifetime-savings.png — הקומפוזיציה היחידה שעברה

בכל סצנה אצרף גם את הגרסה הקודמת שנכשלה.

הפק מחדש את סצנות החגיגה לפי המסמך. שני חוקי הברזל:

1. 40% העליונים של כל תמונה ריקים לחלוטין. הווידג'ט מצייר שם לוגו וכותרת
   בעברית. שום אובייקט לא נכנס לשם — לא ראש, לא יד מורמת, לא כובע,
   לא גביע, לא להבה, לא כרטיס, לא דגל, לא בלון, לא לב.
   ראש המאסקט מתחיל בערך ב-42% מלמעלה.

2. הדמות זהה לתמונות הייחוס: גוף אחד בצורת מלבן מעוגל רך, רחב בתחתית
   עם קודקוד שטוח-מעוגל. לא עיגול. לא ביצה. לא טיפה.
   כל תמונה שבה הדמות עגולה — נפסלת.

בנוסף: אפס טקסט בתמונה. 1:1, 1024x1024, PNG בלי שקיפות, full-bleed.

הפק אחת בכל פעם לפי הסדר שבמסמך. אחרי כל אחת עצור לאישור.
```
