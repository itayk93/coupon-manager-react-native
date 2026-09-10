# בריף מאסקט — מצבי חגיגה וגיימיפיקציה (משפחה חדשה)

**זה לא סדרת התפוגה.** הסדרה הקיימת (`MascotState1..9`) היא מצב אחד — "קופון עומד לפוג" —
בספירה לאחור מ־8+ ימים עד היום. המצבים כאן הם **טריגרים חדשים לגמרי** שמושכים את
המשתמש לאפליקציה דרך רגש חיובי: אבן דרך, ותק, חיסכון, רצף, חבר שהצטרף.

הפלטה כאן **חמה וחיובית** (זהב, טורקיז, זריחה) — לא האדום־פאניקה של סדרת התפוגה.

---

## סטטוס מימוש

התמונות האלה הן קלט לשלב הבא. הווידג'ט הנייטיבי **עדיין לא יודע להציג אותן** —
צריך להוסיף ל־`WidgetPayload` שדות (`lifetimeSavings`, `redeemedCount`, `memberSinceDays`,
`usageStreakWeeks`, `referralCount`, `walletRecord`) ולוגיקת בחירה ב־`CouponWidget.swift` /
`CouponWidgetProvider.kt`. הבריף הזה מייצר את הנכסים כדי שהם יהיו מוכנים.

---

## מפרט טכני (זהה לסדרת התפוגה)

| פרמטר | ערך |
|---|---|
| יחס | 1:1 ריבוע |
| רזולוציה | 1024×1024 (או 1536 ואז downscale) |
| פורמט | PNG בלי שקיפות, full-bleed, בלי מסגרת, בלי רצפה לבנה |
| סגנון | 3D Pixar/Octane, עור מאט ויניל, תאורה קולנועית |
| טקסט בתמונה | **אין.** לא מספרים, לא מילים, לא לוגו. ה־UI מצייר את הטקסט |
| אזור עליון | 35% עליונים כהים/רגועים יחסית — מקום לכותרת לבנה |

**דמות:** אותה שעועית כחולה מלכותית מ־`assets/mascot/widget-originals/MascotState1.png` —
עיניים עגולות עם נצנוץ, גבות שחורות קצרות, בלי אף, ידיים נוב, כפות עגלגלות. זהה בכל מצב.

**מסגור ברירת מחדל:** המאסקט גדול, ממלא ~60–70% מהפריים, מעוגן לתחתית, קלוז־אפ בגובה עיניים
(כמו `MascotState1`), אלא אם כתוב אחרת. רגש חיובי = מצלמה קרובה. זה ההפך ממצבי הדאגה
שבהם המאסקט קטן ורחוק.

---

## המצבים

לכל מצב: טריגר (מאיזה דאטה), פוזה, הבעה, סביבה, פלטה, אפקטים, ופרומפט מוכן.

### C1 — יום שנה ("שנה איתנו!")
- **טריגר:** `memberSinceDays` חוצה 365 (גם 30, 180, 730 — אותה סצנה).
- **פוזה:** המאסקט מאחורי עוגת יום־הולדת עם נרות, זרועות מורמות בהתלהבות, כובע מסיבה על הראש.
- **הבעה:** עיניים עצומות למחצה משמחה, חיוך ענק פתוח.
- **סביבה:** חדר חגיגי, זרי נייר, בלונים (בלי מספרים עליהם), קונפטי נופל, אור זהוב חמים.
- **פלטה:** טורקיז + זהב + ורוד פסטל.
- **אפקטים:** קונפטי, סטרימרים, ניצוצות מהנרות.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render. The cute chubby royal-blue jelly-bean mascot from the reference (matte vinyl skin, one bean body, big round eyes with white sclera + black pupils + white glint, two short black eyebrows, no nose, nub hands, oval feet) — keep identical. Close-up, mascot fills ~65% of the frame, anchored to the bottom, wearing a small party hat, standing behind a birthday cake with lit candles, both arms thrown up in celebration, eyes squeezed happy, huge open smile. ENVIRONMENT: a festive room with paper garlands, plain balloons with NO numbers or text, falling confetti and streamers, warm golden party light. Palette: teal, gold and pastel pink. Sparkles from the candle flames. Keep the top 35% cleaner and darker for UI text overlay. Joyful warm lighting, gold rim light on the blue skin. No text, no numbers, no logos, no border, no white floor.
```

### C2 — אבן דרך בכמות קופונים ("20 קופונים בארנק!")
- **טריגר:** `redeemedCount` או מספר הקופונים הפעילים חוצה 5 / 10 / 25 / 50 / 100.
- **פוזה:** המאסקט עומד על פודיום/במה קטנה ומחזיק גביע זהב מעל הראש בשתי ידיים.
- **הבעה:** גאווה, חיוך רחב, עיניים נוצצות.
- **סביבה:** אור זרקורים מלמעלה, קונפטי זהב, רקע כהה־חגיגי עם קרני אור.
- **פלטה:** זהב + כחול כהה + לבן חם.
- **אפקטים:** ברק על הגביע, קונפטי, קרני זרקור.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Close-up, mascot fills ~60% of the frame, standing on a small podium, holding a shiny gold trophy up above its head with both hands, proud broad smile, sparkling eyes. ENVIRONMENT: spotlight beams from above, gold confetti raining down, a dark festive stage background with light rays. Palette: gold, deep navy and warm white. A bright glint on the trophy. Keep the top 35% dark and clean for UI text overlay. Triumphant lighting, gold rim light on the blue skin. No text, no numbers, no logos, no border.
```

### C3 — חיסכון מצטבר ("חסכת ₪20,000 עד היום")
- **טריגר:** `lifetimeSavings` חוצה 1K / 5K / 10K / 25K / 50K.
- **פוזה:** המאסקט יושב/שוכב מאושר על ערמת מטבעות זהב ענקית, מטבע אחד מחזיק ביד, מטבעות גשם סביבו.
- **הבעה:** אושר רגוע, חיוך שבע רצון, עיניים חצי עצומות.
- **סביבה:** תיבת אוצר פתוחה מאחור, מטבעות זורמים החוצה, אור זהוב זוהר.
- **פלטה:** זהב + ענבר + טורקיז רקע.
- **אפקטים:** ניצוצות על המטבעות, מטבעות נופלים, bokeh זהוב.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Close-up, mascot fills ~60% of the frame, lounging happily on top of an enormous pile of gold coins, holding one coin, relaxed satisfied smile, half-closed happy eyes. ENVIRONMENT: an open treasure chest behind with coins spilling out, coins raining gently, a warm glowing golden light. Palette: gold, amber, with a soft teal background. Sparkles on the coins, golden bokeh. Keep the top 35% calmer and darker for UI text overlay. Warm rich lighting, gold rim light on the blue skin. No text, no numbers, no coin symbols, no logos, no border.
```

### C4 — סיכום חיסכון חודשי ("החודש חסכת ₪340")
- **טריגר:** תחילת חודש, `savingsThisMonth > 0`.
- **פוזה:** המאסקט מחבק קופת חיסכון (חזיר) גדולה, מטבע אחד עומד להיכנס לחריץ.
- **הבעה:** חיוך גאה שקט, מבט למצלמה.
- **סביבה:** דף לוח שנה בודד מתהפך ברקע, אור בוקר רך, מדף עם צמח.
- **פלטה:** טורקיז מנטה + ורוד קופה + זהב.
- **אפקטים:** ניצוץ אחד על המטבע, אבק אור עדין.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Close-up, mascot fills ~62% of the frame, hugging a large piggy bank, one gold coin floating just above the slot, quiet proud smile, looking at the camera. ENVIRONMENT: a single calendar page flipping in the background, soft morning light, a shelf with a small plant. Palette: mint teal, soft pink piggy bank, gold. One sparkle on the coin, gentle light dust. Keep the top 35% clean for UI text overlay. Soft warm lighting, teal rim light on the blue skin. No text, no numbers, no logos, no border.
```

### C5 — רצף שימוש ("3 שבועות ברצף")
- **טריגר:** `usageStreakWeeks >= 2`.
- **פוזה:** המאסקט מרים אגרוף אחד למעלה בנצחון, יד שנייה על המותן, עומד יציב.
- **הבעה:** ביטחון, חיוך צד, גבה מורמת "כן!".
- **סביבה:** להבת אש גדולה וידידותית מאחוריו (סגנון streak של Duolingo), לוח עם סימני וי זוהרים.
- **פלטה:** כתום־להבה + זהב + כחול כהה. (כאן כן חם — אבל חגיגי, לא פאניקה.)
- **אפקטים:** ניצוצות מהלהבה, זוהר סביב הדמות.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Close-up, mascot fills ~62% of the frame, one fist raised triumphantly, other hand on its hip, standing strong, confident half-smile, one eyebrow raised. ENVIRONMENT: a big friendly glowing flame behind it (streak-style), a board with softly glowing check marks. Palette: warm flame orange, gold and deep navy — celebratory heat, NOT panic. Sparks rising from the flame, a glow around the mascot. Keep the top 35% dark and clean for UI text overlay. Heroic warm lighting, orange rim light on the blue skin. No text, no numbers, no logos, no border.
```

### C6 — הצלה ברגע האחרון ("הצלת קופון של ₪120!")
- **טריגר:** קופון מומש כש־`daysUntilExpiration <= 1`.
- **פוזה:** המאסקט לבוש כגיבור־על (גלימה קטנה), תופס בקפיצה קופון/כרטיס שנופל.
- **הבעה:** נחישות + חיוך מנצח, "תפסתי!".
- **סביבה:** שמיים עם ענני קומיקס, קרן אור מאחור, קווי תנועה קלים.
- **פלטה:** תכלת + אדום גלימה + זהב.
- **אפקטים:** ניצוץ בנקודת התפיסה, קווי מהירות עדינים.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference, wearing a tiny superhero cape. Dynamic mid-air shot, mascot fills ~60% of the frame, leaping and catching a falling gift card, determined winning smile. ENVIRONMENT: a bright sky with soft comic-style clouds, a light beam behind, gentle motion lines. Palette: sky blue, red cape, gold. A sparkle at the catch point. Keep the top 35% cleaner for UI text overlay. Bright heroic lighting, cool rim light on the blue skin. No text, no numbers, no logos, no border.
```

### C7 — חודש נקי ("0 קופונים פגו החודש")
- **טריגר:** סוף חודש, `expiredThisMonth === 0`.
- **פוזה:** המאסקט מחזיק מגן/מדליה, עומד זקוף ורגוע, אגודל למעלה.
- **הבעה:** שביעות רצון שקטה, חיוך עדין, עיניים רכות.
- **סביבה:** רקע נקי טורקיז עם וי ענק זוהר מאחור, קרני אור עדינות.
- **פלטה:** טורקיז + לבן + זהב מדליה.
- **אפקטים:** נצנוץ על המדליה, הילה רכה.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Close-up, mascot fills ~62% of the frame, holding a gold medal, standing upright and calm, giving a thumbs up, quiet satisfied smile, soft eyes. ENVIRONMENT: a clean teal background with a giant softly glowing check mark behind, gentle light rays. Palette: teal, white, gold medal. A glint on the medal, a soft halo. Keep the top 35% clean for UI text overlay. Calm bright lighting, teal rim light on the blue skin. No text, no numbers, no logos, no border.
```

### C8 — חבר שהזמנת הצטרף ("חבר חדש הצטרף 🎉")
- **טריגר:** `referralCount` גדל.
- **פוזה:** שני מאסקטים — הכחול הרגיל נותן כיף (high-five) למאסקט כחול־בהיר קטן יותר.
- **הבעה:** שניהם צוחקים, עיניים שמחות.
- **סביבה:** קונפטי, שני קווי אור שנפגשים, רקע חגיגי חמים.
- **פלטה:** כחול + טורקיז + זהב קונפטי.
- **אפקטים:** פיצוץ ניצוצות בנקודת המפגש של הידיים.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render. TWO of the cute royal-blue jelly-bean mascots from the reference: the main one and a slightly smaller, lighter-blue one, giving each other a high-five, both laughing with happy eyes. Close-up, the pair fills ~65% of the frame, anchored to the bottom. ENVIRONMENT: falling confetti, two light trails meeting, a warm festive background. Palette: blue, teal and gold confetti. A burst of sparkles where their hands meet. Keep the top 35% cleaner for UI text overlay. Warm celebratory lighting, gold rim light on the blue skin. No text, no numbers, no logos, no border.
```

### C9 — שיא ארנק אישי ("הארנק שלך שווה ₪4,315 — שיא!")
- **טריגר:** `totalRemainingValue` עובר את המקסימום ההיסטורי.
- **פוזה:** המאסקט עומד על פסגת הר / על עמודת הגרף הגבוהה ביותר, מניף דגל קטן.
- **הבעה:** גאווה, חיוך רחב, מבט אל האופק.
- **סביבה:** גרף עמודות עולה שהופך להרים, שמי זריחה, ציפור אחת.
- **פלטה:** זריחה כתום־ורוד + טורקיז + זהב.
- **אפקטים:** נצנוץ על קצה הדגל, קרני שמש.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Wider shot, mascot at ~50% frame height, standing on the tallest bar of a rising bar chart that blends into mountain peaks, planting a small plain flag, proud broad smile, gazing at the horizon. ENVIRONMENT: sunrise sky, one bird, warm rays. Palette: sunrise orange-pink, teal, gold. A sparkle on the flag tip. Keep the top 35% sky clean for UI text overlay. Uplifting sunrise lighting, warm rim light on the blue skin. No text, no numbers, no chart labels, no logos, no border.
```

### C10 — "מתגעגעים אליך" (re-engagement)
- **טריגר:** `daysSinceLastOpen >= 5` (ואין תפוגה דחופה).
- **פוזה:** המאסקט יושב ליד חלון, מנופף ביד אחת, לחי נשענת על היד השנייה.
- **הבעה:** עצוב־חמוד, גבות מורמות פנימה, חיוך קטן מלא תקווה. **לא בוכה.**
- **סביבה:** חדר מעט מעומעם, שקיעה בחלון, קצת אבק אור, קופסת קופונים סגורה על השולחן.
- **פלטה:** לבנדר + כחול־אפור + ענבר רך מהחלון.
- **אפקטים:** חלקיקי אבק, השתקפות רכה בזכוכית.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Close-up, mascot fills ~60% of the frame, sitting by a window, waving with one hand, the other propping up its cheek, a cute wistful look — inner-raised eyebrows, a small hopeful smile, NOT crying. ENVIRONMENT: a slightly dim room, sunset outside the window, gentle light dust, a closed box of coupons on the desk. Palette: lavender, blue-grey, soft amber from the window. Dust particles, a soft reflection in the glass. Keep the top 35% clean for UI text overlay. Soft melancholic lighting, warm rim light on the blue skin. No text, no numbers, no logos, no border.
```

### C11 — אספן גיוון ("קופונים מ־12 רשתות שונות")
- **טריגר:** `distinctCompanies` חוצה 5 / 10 / 20.
- **פוזה:** המאסקט מחזיק כמה שקיות קניות צבעוניות ביד אחת, נופף בשנייה, קורץ.
- **הבעה:** שובב, קריצה, חיוך צד.
- **סביבה:** לוח פקק מאחור עם פתקים/בולים (בלי טקסט קריא), רחוב קניות מטושטש.
- **פלטה:** צבעוני־פופ על בסיס טורקיז.
- **אפקטים:** ניצוצות קטנים על השקיות.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Close-up, mascot fills ~62% of the frame, holding a bunch of colorful shopping bags in one hand, waving with the other, giving a playful wink and a side smile. ENVIRONMENT: a cork board behind with blank pinned notes and stamps (no readable text), a blurred shopping street. Palette: poppy multicolor over a teal base. Small sparkles on the bags. Keep the top 35% cleaner for UI text overlay. Bright playful lighting, teal rim light on the blue skin. No text, no numbers, no logos, no border.
```

### C12 — נדנוד בוקר ("בוקר טוב! יש לך ₪80 בשופרסל")
- **טריגר:** פתיחה יומית ראשונה בבוקר, יש קופון עם יתרה.
- **פוזה:** המאסקט מותח פיהוק־שמח, מחזיק ספל קפה, מצביע קדימה בעליזות.
- **הבעה:** רענן, עיניים חצי פקוחות אבל מחייך.
- **סביבה:** זריחה מבעד לחלון, אור בוקר זהוב, שקית קניות קטנה לצד.
- **פלטה:** זריחה צהוב־ורוד + טורקיז.
- **אפקטים:** אדים מהספל, קרני שמש רכות.

```text
Full-bleed 1:1 square 3D illustration, Pixar/Octane render, same identical royal-blue jelly-bean mascot as the reference. Close-up, mascot fills ~62% of the frame, doing a happy morning stretch, holding a coffee mug, pointing forward cheerfully, fresh look with half-open eyes and a smile. ENVIRONMENT: sunrise through a window, golden morning light, a small shopping bag beside it. Palette: sunrise yellow-pink and teal. Steam from the mug, soft sun rays. Keep the top 35% clean for UI text overlay. Warm morning lighting, golden rim light on the blue skin. No text, no numbers, no logos, no border.
```

---

## צ'קליסט קבלה

- [ ] דמות זהה לייחוס (`MascotState1.png`).
- [ ] רגש **חיובי** (חוץ מ־C10 שהוא עצוב־חמוד, ו־C6 נחוש). אין פאניקה, אין צווחה.
- [ ] פלטה חמה/חיובית — זהב, טורקיז, זריחה. לא אדום־פאניקה (C5 כתום חגיגי מותר).
- [ ] 35% עליונים כהים/רגועים לטקסט לבן.
- [ ] אפס טקסט/מספרים/סמלי מטבע/לוגו בתמונה. בלונים ולוחות בלי כיתוב.
- [ ] 1:1, 1024×1024, PNG בלי שקיפות, full-bleed, בלי רצפה לבנה, בלי מסגרת.
- [ ] המאסקט גדול וקרוב (~60–70%), חוץ מ־C9 שהוא רחב יותר.
