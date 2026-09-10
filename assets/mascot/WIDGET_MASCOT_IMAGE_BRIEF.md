# בריף ליצירת תמונות המאסקט לווידג'ט (למודל תמונות / GPT)

מסמך הפקה לתשע סצנות המאסקט של ווידג'ט "מסך הבית — התראת תפוגה".
כל סצנה היא **איור מלא (full-bleed)** בפורמט ריבועי, דמות + רקע כיחידה אחת, בלי גזירה ובלי רקע שקוף.

איך להשתמש במסמך:

1. צרף את תמונות הייחוס הקיימות מ־`assets/mascot/widget-originals/` (`MascotState1.png` … `MascotState9.png`).
   הן הקנון. הדמות, הפרופורציות, סוג הרינדור והתאורה חייבים להיות זהים להן.
2. הפק סצנה אחת בכל פעם. אל תבקש מהמודל "סט של 9" — הוא יאבד עקביות.
3. לכל סצנה יש כאן: תפקיד, פוזה, הבעה, רקע, תאורה, אפקטים, מסגור, ופרומפט מוכן באנגלית.
4. הפרומפטים באנגלית בכוונה — מודלי תמונה מדייקים יותר. הכותרות והתיאורים בעברית לצוות.

---

## 1. מפרט טכני

| פרמטר | ערך |
|---|---|
| יחס | 1:1 ריבוע מדויק |
| רזולוציה | 1024×1024 (או 1536×1536 ואז downscale) |
| פורמט | PNG, ללא שקיפות, ללא אלפא |
| קצוות | full-bleed. אין מסגרת, אין שוליים לבנים, אין רצפה לבנה, אין קו גזירה |
| סגנון | 3D render בסגנון Pixar / Octane, עור מאט ויניל, תאורה קולנועית רכה |
| טקסט בתוך התמונה | **אין.** שום מילה, מספר או אימוג'י. השכבות של הטקסט מצוירות ע"י הקוד |

לאחר האישור: iOS ל־`targets/widget/Assets.xcassets/MascotState{N}.imageset/` (600×600),
אנדרואיד ל־`modules/coupon-widget/android/src/main/res/drawable-nodpi/mascot_scene_{k}.png` (1254×1254).

---

## 2. תנ"ך הדמות (זהה בכל הסצנות)

- **צורה:** דמות "שעועית"/ג'לי־בין שמנמנה, גוף אחד ביצתי, בלי צוואר. ראש גדול מתמזג לגוף.
- **צבע:** כחול מלכותי רווי (royal blue, ~#1E4FD8). עור מאט, חלק, מעט סאב־סרפיס.
- **עיניים:** שתי עיניים עגולות גדולות, לובן לבן, אישון שחור גדול, נצנוץ לבן קטן אחד. ממוקמות גבוה במרכז הפנים.
- **גבות:** שני קווים שחורים קצרים ועבים. הן כל מנוע ההבעה — זווית הגבה קובעת רגש.
- **אף:** אין.
- **פה:** קו/צורה אדמדמה. חיוך פתוח עם לשון ורודה בשמחה; קו מכווץ בדאגה; פה פעור עם שיניים+לשון בפאניקה.
- **ידיים:** שני גדמים כחולים קצרים, כף יד עגלגלה עם 3–4 אצבעות נוב. בלי פרקים.
- **רגליים:** שתי כפות עגלגלות קטנות ישירות מתחת לגוף.
- **גובה עור:** תמיד מקבל את גוון האור של הרקע (ציאן / ענבר / כתום־אש / אדום) כ־rim light על הקצוות.
- **בלי בגדים, בלי אביזרים, בלי מותג על הגוף.**

עוגן: `assets/mascot/original_app_mascot.png` + תמונות הייחוס.

---

## 3. אזורי הקומפוזיציה

```
+------------------------------------------+  ← 0%
|   35% עליון — "אזור שקט"                  |
|   כהה יחסית, בלי דמות, בלי עצמים גדולים.  |
|   הקוד מצייר פה: אייקון+ימים, צ'יפ חנות,  |
|   כותרת עברית, חץ דפדוף.                  |
+------------------------------------------+  ← 35%
|                                          |
|   65% תחתון — הבמה של המאסקט.             |
|   הדמות מעוגנת לתחתית הפריים.             |
|                                          |
+------------------------------------------+  ← 100%
```

חוק: **החצי העליון תמיד נושם.** גם בסצנות הפאניקה, שמור ריכוז ניגודיות וטקסטורה נמוך ב־35% העליונים כדי שטקסט לבן יישב מעליו.

---

## 4. שני מצבי מסגור

| מצב | סצנות | מצלמה | קנה מידה של הדמות | קרקע |
|---|---|---|---|---|
| **A — שמחה/רוגע** | State1 | קלוז־אפ, גובה עיניים | ממלאה ~75% מהפריים, מוסטת מעט שמאלה | רמוזה (עננים) |
| **B — הרהור/דאגה** | State2–State7 | רחוק, מעט מלמעלה | קטנה, ~35–48% גובה, במרכז, המון אוויר מעליה | משטח מחזיר אור עם השתקפות |
| **C — פאניקה** | State8–State9 | טלה, קרוב, דינמי | גדולה, ~55–62%, במרכז, רצה אל המצלמה | קווי מהירות רדיאליים, בלי משטח ברור |

---

## 5. סולם הצבע והרגש (מתפוגה רחוקה → היום)

| State | ימים לתפוגה | פלטת רקע | רגש | פוזה מרכזית |
|---|---|---|---|---|
| 1 | 8+ (רגוע) | ציאן / תכלת שמיים + עננים + קרני שמש | שמחה מתפרצת | ריצת דילוג, שתי ידיים למעלה, חיוK ענק |
| 2 | 7 | נייבי עמוק + זוהר ענבר מאחור, בוקה | סקרנות קלה | עמידה, יד לסנטר, גבה אחת מורמת |
| 3 | 6 | נייבי + ענבר, בוקה | מהורהר, מוטרד קלות | יד לסנטר, פה מכווץ, טיפת זיעה |
| 4 | 5 | נייבי + ענבר חמים יותר | דאגה מתגברת | יד לסנטר, מבט מודאג למעלה, טיפת זיעה |
| 5 | 4 | מעבר לכתום־אש + בוקה גחלים, קרני ספוט | לחץ, מכרסם ציפורניים | שתי ידיים לפה, שיניים חשוקות, 2 טיפות |
| 6 | 3 | כתום־אש רווי | חרדה | אותה פוזת כרסום, קצת יותר גדולה |
| 7 | 2 | כתום־אדום עמוק, ספוט חזק | חרדה גבוהה | פוזת כרסום, הדמות ממלאה יותר פריים |
| 8 | 1 (מחר) | אדום דם + קווי מהירות + פסולת מעופפת | פאניקה — "הצעקה" | רצה למצלמה, שתי ידיים לצדי הראש, פה פעור צורח |
| 9 | 0 (היום) | אדום וולקני + התפוצצות אור רדיאלית | היסטריה מוחלטת | רצה, ידיים מתנופפות לצדדים, פה פעור לרווחה, תרסיס זיעה |

מיפוי קבצים:

| State (iOS) | קובץ iOS | קובץ אנדרואיד |
|---|---|---|
| MascotState1 | `MascotState1.png` | — (אנדרואיד מציג מסך סטטיסטיקות ברוגע) |
| MascotState2 | `MascotState2.png` | `mascot_scene_7.png` |
| MascotState3 | `MascotState3.png` | `mascot_scene_6.png` |
| MascotState4 | `MascotState4.png` | `mascot_scene_5.png` |
| MascotState5 | `MascotState5.png` | `mascot_scene_4.png` |
| MascotState6 | `MascotState6.png` | `mascot_scene_3.png` |
| MascotState7 | `MascotState7.png` | `mascot_scene_2.png` |
| MascotState8 | `MascotState8.png` | `mascot_scene_1.png` |
| MascotState9 | `MascotState9.png` | `mascot_scene_0.png` |

(אנדרואיד ממספר לפי ימים שנותרו: `scene_0` = היום. iOS ממספר הפוך: `State9` = היום. אותה תמונה בדיוק, שם אחר.)

---

## 6. הסצנות

לכל סצנה: הדבק את הפרומפט, צרף את קובץ הייחוס המתאים, ובקש "match this exact character, same 3D style".

### State 1 — רגוע / בטוח (8+ ימים)
- **תפקיד:** ברירת המחדל. אין תפוגה קרובה. הכל טוב. מזמין ללחוץ בלי לחץ.
- **מסגור:** מצב A. קלוז־אפ, הדמות ~75%, מרכז מעט שמאלה, גובה עיניים.
- **פוזה:** אמצע קפיצת דילוג — רגל אחת בעיטה קדימה, שתי ידיים פרושות למעלה בחגיגה, ראש מוטה קלות.
- **פנים:** עיניים רחבות שמחות, גבות מורמות רגועות, פה פתוח ענק בחיוך עם לשון ורודה.
- **רקע:** שמיים ציאן→תכלת בהיר, עננים לבנים רכים בתחתית, קרני שמש דיאגונליות מימין־למעלה.
- **אפקטים:** קונפטי לבן מרחף, כוכבי זהב קטנים מנצנצים. אווירה בהירה ואופטימית.
- **אור:** יום בהיר, מפוזר, rim light תכלת על הקצוות.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render style. A cute chubby royal-blue jelly-bean mascot with smooth matte vinyl skin, one big single bean-shaped body, no neck, large round cartoon eyes with white sclera, big black pupils and a tiny white glint, two short thick black eyebrows, no nose, wide open joyful smile with a pink tongue, short blue nub arms with rounded 3-4 finger hands, two small oval feet. The mascot is large, filling about 75% of the frame, positioned slightly left of center at eye level, caught mid skip-jump: one leg kicked forward, both arms thrown up in celebration, head tilted slightly. Background: a bright rich cyan to light sky-blue gradient sky with soft white clouds along the bottom and diagonal warm sun rays from the top right. Floating white confetti and small glowing gold stars. Keep the top 35% of the image cleaner and less busy for UI text overlay. Bright optimistic lighting, cyan rim light on the blue skin. No text, no logos, no border, no white floor.
```

### State 2 — עירני (7 ימים)
- **תפקיד:** תזכורת ראשונה עדינה. "יש משהו באופק."
- **מסגור:** מצב B. שוט רחב, הדמות קטנה (~35% גובה), במרכז, עומדת על משטח מחזיר אור, הרבה אוויר מעליה.
- **פוזה:** עומד, יד אחת מונחת על הסנטר במחשבה, היד השנייה רפויה לצד.
- **פנים:** גבה אחת מורמת בסקרנות, השנייה רגועה, פה קו ניטרלי־קל, טיפת זיעה זעירה אחת ליד הרקה.
- **רקע:** גרדיאנט נייבי עמוק / כחול־לילה. זוהר ענבר־צהוב חמים בוקע מאחורי הדמות ומלמטה. כדורי בוקה מטושטשים.
- **אפקטים:** חלקיקי אבק מרחפים. מצב רוח אטמוספרי שקט.
- **אור:** נמוך, קונטרה־לייט ענבר מאחור, קדמת הדמות בצל כחול.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render style. The same cute chubby royal-blue jelly-bean mascot (matte vinyl skin, one bean body, no neck, big round eyes with white sclera and black pupils and a white glint, two short black eyebrows, no nose, nub hands, small oval feet) — keep the character identical to the reference. Wide shot, camera slightly above. The mascot is SMALL, only about 35% of the frame height, standing centered on a softly reflective floor, with lots of empty space above it. Pose: standing, one hand resting on its chin in thought, other arm loose at the side. Face: one eyebrow raised curiously, calm neutral mouth, one tiny sweat droplet near the temple. Background: deep navy and midnight-blue gradient with a warm amber-yellow glow rising from behind and below the mascot, soft out-of-focus bokeh orbs, floating dust particles. Keep the top 35% dark and clean for UI text overlay. Quiet atmospheric mood, amber backlight and blue front shadow, amber rim light on the blue skin. No text, no logos, no border.
```

### State 3 — דאגה קלה (6 ימים)
- **מסגור:** מצב B, זהה ל־State2.
- **פוזה:** יד לסנטר, גוף מעט מכונס.
- **פנים:** שתי גבות מורמות פנימה (דאגה), פה קו הפוך קטן, טיפת זיעה אחת בולטת.
- **רקע:** נייבי + ענבר, בוקה — מעט יותר חם מ־State2.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Wide shot, camera slightly above, mascot SMALL at about 38% frame height, centered on a faintly reflective floor, large empty space above. Pose: one hand on chin, body slightly hunched. Face: both eyebrows tilted up in worry, a small downturned mouth, one visible sweat droplet on the forehead, eyes glancing up nervously. Background: deep navy-indigo gradient with a warm amber glow from behind and below, soft glowing bokeh particles, slightly warmer than a calm scene. Keep the top 35% darker and clean for UI text overlay. Atmospheric, moody, amber rim light on the blue skin. No text, no logos, no border, no white floor.
```

### State 4 — דאגה מתגברת (5 ימים)
- **מסגור:** מצב B.
- **פוזה:** יד לסנטר, מבט מודאג ברור כלפי מעלה.
- **פנים:** גבות דאגה חדות יותר, פה מכווץ, טיפת זיעה.
- **רקע:** נייבי + ענבר חם יותר, הבוקה בהיר יותר. זה הסצנה האחרונה בפלטת הכחול לפני המעבר לחם.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Wide shot, camera slightly above, mascot SMALL at about 42% frame height, centered on a reflective floor, empty space above. Pose: hand on chin, clearly anxious, looking up. Face: sharply worried eyebrows, tight pressed mouth, a sweat droplet, big worried eyes. Background: navy-indigo gradient with a stronger warmer amber glow from below and behind, brighter bokeh orbs — the last scene before the palette turns hot. Keep the top 35% clean for UI text overlay. Atmospheric moody lighting, amber rim light on the blue skin. No text, no logos, no border, no white floor.
```

### State 5 — לחץ (4 ימים)
- **תפקיד:** מעבר צבע. מכאן הרקע חם ולוחץ.
- **מסגור:** מצב B אך הדמות מעט גדולה יותר (~45%).
- **פוזה:** שתי ידיים מקורבות לפה, מכרסם ציפורניים.
- **פנים:** שיניים חשוקות גלויות, שתי טיפות זיעה, עיניים מודאגות כלפי מעלה, גבות פנימה.
- **רקע:** כתום־אש רווי עם בוקה גחלים כתומות, קרני ספוט דיאגונליות מימין־למעלה.
- **אור:** rim light כתום חזק על העור הכחול.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Medium-wide shot, mascot at about 45% of the frame height, centered, standing on a glowing floor. Pose: both hands brought up to the mouth, nervously biting its nails. Face: gritted visible teeth, two sweat droplets, worried eyes looking up, eyebrows pulled in. Background: a rich fiery orange gradient with glowing orange ember bokeh and diagonal spotlight rays from the top right. Keep the top 35% darker and clean for UI text overlay. Strong orange rim light wrapping the blue skin, cinematic. No text, no logos, no border, no white floor.
```

### State 6 — חרדה (3 ימים)
- **מסגור:** מצב B, הדמות ~48%.
- **פוזה:** אותה פוזת כרסום ציפורניים.
- **פנים:** זהה ל־State5, מעט מוגברת.
- **רקע:** כתום־אש רווי יותר, פחות נייבי בפינות.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Mascot at about 48% of the frame height, centered, on a glowing floor. Pose: both hands at the mouth, biting nails, shoulders drawn up. Face: clenched teeth, sweat droplets on the forehead, big anxious eyes looking up, worried inner eyebrows. Background: a saturated fiery orange and burnt-amber gradient with glowing ember bokeh and diagonal spotlight rays from upper right, deeper and hotter than the previous scene. Keep the top 35% cleaner for UI text overlay. Intense orange rim light on the blue skin. No text, no logos, no border, no white floor.
```

### State 7 — חרדה גבוהה (2 ימים / "יומיים")
- **מסגור:** מצב B→C. הדמות גדולה יותר (~50%), הרקע דרמטי.
- **פוזה:** פוזת כרסום, גוף מכונס.
- **פנים:** זהה, זיעה כבדה יותר.
- **רקע:** כתום־אדום עמוק, החלק העליון אדום־בורדו כהה, ספוט חזק מימין־למעלה, בוקה גחלים.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Mascot at about 50% of the frame height, centered, on a glowing hot floor. Pose: both hands clutched at the mouth, biting nails, body hunched and tense. Face: gritted teeth, multiple sweat droplets running down, wide fearful eyes looking up. Background: a deep orange-to-crimson gradient, dark burgundy-red at the very top, a strong spotlight beam from the upper right, glowing ember bokeh. Keep the top 35% dark enough for white UI text overlay. Dramatic hot rim light on the blue skin. No text, no logos, no border, no white floor.
```

### State 8 — פאניקה (מחר / יום אחד)
- **תפקיד:** דחיפות שיא. "עכשיו או לעולם לא."
- **מסגור:** מצב C. טלה קרוב, הדמות גדולה (~58%), במרכז, רצה אל המצלמה.
- **פוזה:** ריצה קדימה, שתי ידיים אוחזות בצדי הראש ("הצעקה" של מונק).
- **פנים:** פה פעור לרווחה בצעקה עם שיניים ולשון, עיניים פעורות בהלם, גבות מורמות, טיפות זיעה עפות לשני הצדדים.
- **רקע:** אדום דם רווי, קווי מהירות רדיאליים מהמרכז, קוביות/פסולת אדומות מעופפות, טשטוש תנועה.
- **אור:** התפרצות אור חמה מאחורי הדמות, rim light אדום.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Tight dynamic shot, mascot LARGE at about 58% of the frame, centered, running straight toward the camera. Pose: mid-run, both hands clutching the sides of its head in a panic "The Scream" pose. Face: mouth wide open screaming with visible teeth and tongue, huge shocked round eyes, eyebrows raised high, sweat droplets flying off both sides of the head. Background: an intense blood-red gradient with radial speed lines bursting from the center, red motion-blurred cubes and debris flying past, a warm light burst behind the character. Keep the top 35% a bit calmer for UI text overlay. Red rim light on the blue skin, cinematic motion. No text, no logos, no border.
```

### State 9 — היסטריה (היום / פג היום)
- **תפקיד:** הדחיפות המקסימלית. אחרון.
- **מסגור:** מצב C, אף יותר קיצוני. הדמות ~55%, רצה, דינמיקה מקסימלית.
- **פוזה:** ריצת אמוק, שתי ידיים מתנופפות פרושות לצדדים למעלה, גוף נטוי קדימה.
- **פנים:** פה פעור לרווחה בצעקת אימה, עיניים בולטות, תרסיס טיפות זיעה לכל הכיוונים.
- **רקע:** אדום וולקני, התפוצצות אור רדיאלית לבנה־צהובה במרכז, קווי מהירות אינטנסיביים, הקצוות אדום כהה.
- **אור:** הבוהק החזק ביותר בסדרה, מרכז כמעט זוהר.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Tight dynamic shot, mascot at about 55% of the frame, centered, sprinting in full panic. Pose: frantic run, both arms flailing wide and up, body leaning forward. Face: mouth stretched wide open in a terrified scream, bulging eyes, a spray of sweat droplets flying in every direction. Background: a volcanic deep-red gradient with a bright white-yellow radial light explosion at the center, intense radial speed lines, dark crimson edges. Keep the top 35% readable for white UI text overlay despite the energy. Brightest scene of the set, strong red rim light on the blue skin. No text, no logos, no border.
```

---

## 7. צ'קליסט QA לכל תמונה מוחזרת

- [ ] 1:1 מדויק, ללא שקיפות, ללא מסגרת/שוליים לבנים.
- [ ] הדמות זהה לייחוס: כחול מלכותי, גוף ביצה אחד, עיניים עגולות עם נצנוץ, גבות שחורות, בלי אף.
- [ ] אין שום טקסט / מספר / אימוג'י / לוגו בתמונה.
- [ ] 35% העליונים כהים ורגועים מספיק לטקסט לבן.
- [ ] קנה המידה והמסגור תואמים למצב (A / B / C) בטבלה.
- [ ] פלטת הרקע תואמת את מדרגת הימים (ציאן → נייבי/ענבר → כתום → אדום).
- [ ] אור הרקע נשפך על העור הכחול כ־rim light.
- [ ] הדמות מעוגנת לתחתית, אין רצפה לבנה ואין קו גזירה.
- [ ] רצף: הנח את 2→3→4 זה לצד זה — ההסלמה עדינה ורציפה. 5→6→7 בכתום. 8→9 בפאניקה.

---

## 8. רקעים ייחודיים לכל מצב — גרסה 2 (השתמש בפרומפטים האלה)

**הבעיה בגרסה 1:** כל הרקעים יצאו אותו דבר — גרדיאנט + בוקה. משעמם.
**הפתרון:** כל מצב מקבל **סביבה אמיתית משלו** עם אובייקטים ומטאפורה, לא רק צבע.
הרעיון המנחה: הזמן שנגמר = הרצפה שמתחת למאסקט הופכת מאדמה בטוחה → סדקים → לבה → התפרצות.
הפלטה (ציאן→נייבי→כתום→אדום) והכלל של "35% עליון שקט" נשמרים בדיוק.

| State | מטאפורת סביבה | אובייקטים ייחודיים ברקע |
|---|---|---|
| 1 | אחו פתוח ביום שמש | דשא, גבעות רכות, שמיים עם ענן בודד, מטבעות זהב מרחפים, פרפר |
| 2 | פינת עבודה חמימה בערב | לוח שנה על הקיר עם תאריך אחד מוקף רחוק, מנורת שולחן, ספל |
| 3 | אותו חדר, השעה מאוחרת | שעון קיר גדול, דפי לוח שנה שנתלשים ומתעופפים, חלון עם דמדומים |
| 4 | חדר עם שעון חול ענק | שעון חול תלת־ממדי מאחור, החול כמעט נגמר בתא העליון, אבק ענבר באוויר |
| 5 | הרצפה מתחילה להיסדק | סדקים דקים בקרקע עם זוהר כתום מבפנים, ניצוצות בודדים עולים |
| 6 | הסדקים מתרחבים, אש קטנה | סדקים רחבים, להבות קטנות בקצוות, פסי אזהרה צהוב־שחור מטושטשים בצל |
| 7 | החדר בוער בקצוות | להבות בהיקף, עשן מתערבל, אור חירום אדום מסתובב, גחלים עפות |
| 8 | מסדרון קורס בשריפה | קורות נופלות, פסולת מעופפת, אור סירנה, טשטוש תנועה, ניצוצות |
| 9 | התפרצות / הכל מתפוצץ | גל הדף, שעון עגול ריק (בלי מספרים) מתנפץ מאחור, מגמה, פיצוץ אור מרכזי |

### פרומפט State 1 — אחו שטוף שמש
```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render. The same cute chubby royal-blue jelly-bean mascot as the reference (matte vinyl skin, one bean body, no neck, big round eyes with white sclera + black pupils + white glint, two short black eyebrows, no nose, nub hands, oval feet) — keep identical. Close-up, mascot fills ~75% of frame, slightly left of center, mid skip-jump with both arms up and a huge open smile with pink tongue. ENVIRONMENT: a sunny open green meadow with soft rolling hills, a bright cyan sky with one fluffy white cloud, warm sun rays from the upper right. Floating gold coins drifting near the mascot, one small butterfly, a few dandelion seeds in the air. Top 35% is open sky, clean for UI text. Bright cheerful daylight, cyan and green light bouncing on the blue skin. No text, no logos, no border, no white floor.
```

### פרומפט State 2 — פינת עבודה חמימה
```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Wide shot, camera slightly above, mascot SMALL at ~35% frame height, standing centered on a wooden floor, lots of space above. Pose: one hand on chin in thought, other arm loose, one eyebrow raised curiously, tiny sweat droplet. ENVIRONMENT: a cozy dim home-office corner at night. On the back wall a paper wall-calendar with a single date circled in red, far away. A warm desk lamp glowing to one side, a coffee mug on the floor nearby, faint steam. Deep navy shadows, warm amber pool of lamp light around the mascot, gentle bokeh from the lamp. Top 35% is dark wall, clean for UI text. Amber key light, blue fill, amber rim on the blue skin. No text on the calendar, no numbers, no logos, no border.
```

### פרומפט State 3 — החדר בשעה מאוחרת
```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Wide shot, mascot SMALL at ~38% frame height, centered on a wooden floor, hunched slightly, one hand on chin, both eyebrows tilted up in worry, small downturned mouth, one clear sweat droplet. ENVIRONMENT: the same dim room, later at night. A large round wall clock behind, hands near the top. Several torn calendar pages caught mid-air, fluttering and falling around the mascot. A window showing deep dusk-purple sky. Navy-indigo room with a warmer amber glow than before, soft falling-paper motion blur. Top 35% dark wall, clean for UI text. Moody amber-and-blue lighting, amber rim on the blue skin. No readable text, no numbers, no logos, no border.
```

### פרומפט State 4 — שעון החול
```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Wide shot, mascot SMALL at ~42% frame height, centered, hand on chin, looking up anxiously at a giant object behind it, sharply worried eyebrows, tight mouth, a sweat droplet. ENVIRONMENT: a dark room dominated by an enormous 3D hourglass standing behind the mascot; the top glass bulb is almost empty, a thin stream of glowing amber sand still falling. Amber sand dust floating in the air, faint light passing through the glass. Navy-indigo room turning warmer, brighter amber bokeh near the sand — the last cool-palette scene before it turns hot. Top 35% clean and dark for UI text. Amber glow through glass, amber rim on the blue skin. No text, no numbers, no logos, no border.
```

### פרומפט State 5 — הרצפה נסדקת
```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Medium-wide shot, mascot at ~45% frame height, centered, both hands up at its mouth biting its nails, gritted visible teeth, two sweat droplets, worried eyes up. ENVIRONMENT: the mascot stands on cracked dark ground; thin fissures spread out from under its feet with a hot orange glow shining up through the cracks. A few glowing embers and sparks rising slowly. The air takes on a fiery orange cast, dark burnt edges. Diagonal warm light from the upper right. Top 35% still darker and clean for UI text. Strong orange under-light and rim light on the blue skin, cinematic. No text, no logos, no border.
```

### פרומפט State 6 — הסדקים מתרחבים
```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Mascot at ~48% frame height, centered, both hands at mouth biting nails, shoulders drawn up, clenched teeth, sweat on the forehead, big anxious eyes. ENVIRONMENT: the cracked ground has broken into wide glowing chasms of orange lava-light; small flames flicker along the edges of the frame. Faint blurred yellow-and-black hazard-stripe shadows on a back wall. Thick smoky orange atmosphere, ember bokeh, hotter and deeper than the previous scene. Top 35% cleaner for UI text. Intense orange firelight and rim light on the blue skin. No readable text, no logos, no border.
```

### פרומפט State 7 — החדר בוער בקצוות
```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Mascot at ~50% frame height, centered, both hands clutched at its mouth, body hunched and tense, gritted teeth, multiple sweat droplets running down, wide fearful eyes. ENVIRONMENT: the room is now on fire around the edges — flames licking up the left and right borders, curling smoke, a spinning red emergency light casting a rotating glow, embers drifting across. Deep orange-to-crimson air, dark burgundy at the very top. Strong spotlight beam from upper right. Top 35% dark enough for white UI text. Dramatic red-orange firelight and rim light on the blue skin. No text, no logos, no border.
```

### פרומפט State 8 — מסדרון קורס
```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Tight dynamic shot, mascot LARGE at ~58% of frame, centered, running straight toward the camera, both hands clutching the sides of its head in a panic "Scream" pose, mouth wide open screaming with teeth and tongue, huge shocked eyes, eyebrows high, sweat flying off both sides. ENVIRONMENT: a burning collapsing corridor — a wooden beam falling from above, chunks of debris and sparks flying past the camera, a red siren light flooding the scene, heavy motion blur streaking backward, radial speed lines. Blood-red and ember tones, a warm blast of light behind the mascot. Top 35% slightly calmer for UI text. Red rim light on the blue skin, cinematic chaos. No text, no logos, no border.
```

### פרומפט State 9 — התפרצות
```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Tight dynamic shot, mascot at ~55% of frame, centered, sprinting in full panic, both arms flailing wide and up, body leaning forward, mouth stretched wide open in a terrified scream, bulging eyes, a spray of sweat droplets in every direction. ENVIRONMENT: everything is exploding — a shockwave ring blasting outward, a plain round wall clock with NO numbers shattering into pieces behind the mascot, glowing magma and flying rock, a bright white-yellow radial light explosion at the center, intense radial speed lines, dark crimson edges. Brightest, most violent scene of the set. Top 35% still readable for white UI text. Strong red rim light on the blue skin. No text, no numbers on the clock, no logos, no border.
```
