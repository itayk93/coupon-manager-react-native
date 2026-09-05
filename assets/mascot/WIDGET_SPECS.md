# מפרט תמונות וידג'ט מאסקט (Duolingo Style 1x1)

כל התמונות צריכות להיות תמונות סצנה מלאות (Full-Bleed), שבהן הדמות והרקע נוצרים כיחידה אחת בתלת-ממד (Pixar/3D Render), ללא צורך בגזירה.

---

## 1. מידות ופורמט טכני
- **יחס ממדים:** 1:1 (ריבוע מושלם)
- **רזולוציה:** `1024x1024` פיקסלים
- **פורמט:** PNG או JPG איכותי

---

## 2. חלוקת שטח הוידג'ט (Layout)

```
+------------------------------------------+
|  [35% עליון - אזור נקי / כהה לתוכן ה-UI] |
|  🔥 1  [VANS • ₪50]             •• <     |
|  דחיפות גבוהה!                           |
+------------------------------------------+
|                                          |
|  [65% תחתון - המאסקט מעוגן לתחתית]       |
|                                          |
|                (  •  •  )                |
|               (   \__/   )               |
|              / |        | \              |
+------------------------------------------+
```

### אזור עליון (35% עליונים):
- חייב להיות **כהה ונקי יחסית** מעצמים גדולים.
- ה-iOS WidgetKit מצייר באזור זה בשכבה מעל:
  1. **צד שמאל למעלה:** אייקון + מספר ימים שנותרו (`🔥 1`, `🚨 0`, `⏳ 3`, `✓`).
  2. **לצד המספר:** צ'יפ קפסולה זכוכית עם שם החנות והסכום (`VANS • ₪50`).
  3. **מתחת למספר:** כותרת דחיפות בעברית (`דחיפות שיא!`, `דחיפות גבוהה!`, `דחיפות עולה`, `שים לב`, `הכל רגוע`).
  4. **צד ימין למעלה:** כפתור דפדוף אינטראקטיבי (מעבר לפייס הסטטיסטיקות).

### אזור תחתון (65% תחתונים):
- **המאסקט:** דמות השעועית הכחולה והשמנמנה של האפליקציה (לפי `original_app_mascot.png`).
- המאסקט **ענק** וממלא את רוב השטח התחתון.
- הגוף מעוגן לקצה התחתון של הפריים.
- **תאורה סביבתית:** אור הרקע (אדום/כתום/ענבר) משתקף על העור הכחול של המאסקט.
- **ללא רצפה לבנה, ללא קווי חיתוך, ללא שוליים.**

---

## 3. חמשת מצבי הדחיפות והפרומפטים

### מצב 1: רגוע / בטוח (Normal - מעל 7 ימים לתפוגה)
- **שם קובץ:** `widget_scene_1.png`
- **תיאור:** מאסקט שמח, מניף ידיים למעלה בחגיגה. רקע טורקיז-ציאן עשיר עם קרני אור וניצוצות זוהרים.
- **פרומפט מוכן:**
```text
Duolingo-style full-bleed mobile app widget background illustration (1:1 square). The image features a cute chubby 3D royal-blue jelly-bean mascot character with smooth matte vinyl skin, large round cartoon eyes with white sclera and round black pupils, no nose, small eyebrows, cheerful smiling mouth, raising both arms happily in the air. The blue mascot fills the lower 65% of the frame, anchored to the bottom edge. Background is a rich vibrant cyan, electric blue, and deep sapphire gradient with subtle glowing sparkles and magical sunrays from top right. Clean darker space at the top 35% for UI text overlay. High quality 3D Pixar render style, Octane render, beautiful lighting.
```

---

### מצב 2: עירני / תשומת לב (Alert - 5 עד 7 ימים לתפוגה)
- **שם קובץ:** `widget_scene_2.png`
- **תיאור:** מאסקט מהרהר/סקרן, יד אחת על הסנטר במחשבה, גבה מורמת, טיפת זיעה קטנה, מבט הצידה. רקע כחול אינדיגו/לילה עמוק עם הילת אור חמימה מלמטה.
- **פרומפט מוכן:**
```text
Duolingo-style full-bleed mobile app widget background illustration (1:1 square). The image features the same cute 3D chubby royal-blue mascot character. The mascot is huge, filling the lower 65% of the frame, anchored to the bottom edge, looking slightly up and to the side with one hand on his chin in thought, one eyebrow raised curiously, slight worried expression with one small sweat droplet. Background is a deep navy-indigo and twilight blue gradient with a warm amber-yellow ambient glow from below, subtle floating dust particles, clean empty space at the top 35% for UI text overlay. Beautiful 3D Pixar style, rich atmospheric mood.
```

---

### מצב 3: מודאג / דחיפות עולה (Anxious - 2 עד 4 ימים לתפוגה)
- **שם קובץ:** `widget_scene_3.png`
- **תיאור:** מאסקט לחוץ, נושך ציפורניים בידיים רועדות, טיפות זיעה זולגות על המצח, עיניים מודאגות מביטות למעלה. רקע ענברי-כתום עמוק (Amber Sunset) עם חלקיקי אור (bokeh).
- **פרומפט מוכן:**
```text
Duolingo-style full-bleed mobile app widget background illustration (1:1 square). The image features the same cute 3D chubby royal-blue mascot character. The mascot fills the lower 65% of the frame, anchored to the bottom edge, visibly anxious and biting his nails or clutching his chest with both hands, worried trembling mouth, sweat droplets on his face, big worried eyes looking up nervously. Background is a dramatic deep warm amber, burnt orange, and dark burgundy gradient with subtle glowing particles, clean darker empty space at the top 35% for UI text overlay. High quality 3D Pixar render style, rich atmospheric mood.
```

---

### מצב 4: פאניקה גבוהה (Urgent - יום אחד / פג תוקף מחר!)
- **שם קובץ:** `widget_scene_4.png`
- **תיאור:** מאסקט בהיסטריה, אוחז בצדי הראש ("צעקת מונק"), עיניים פעורות בהלם, פה פעור בצעקה (לשון ורודה ושיניים מצוירות), טיפות זיעה עפות לצדדים. רקע כתום-אש וגחלים לוהטות (Fiery Ember) עם ניצוצות ותאורת ספוט דרמטית מאחוריו.
- **פרומפט מוכן:**
```text
Duolingo-style full-bleed mobile app widget background illustration (1:1 square). The image features the same cute 3D chubby royal-blue mascot character. State: High Panic (coupon expires tomorrow!). The blue mascot is huge, filling the lower 65% of the frame, anchored to the bottom edge, clutching the sides of his head in panic ("The Scream" pose), wide shocked round cartoon eyes with white sclera and black pupils, open mouth screaming in distress, sweat drops flying off his head. The character is completely integrated into the scene, with fiery orange ambient rim light reflecting on his blue skin. Background is an intense glowing fiery ember-orange and dark crimson red gradient with subtle glowing sparks, darker empty space at the top 35% for UI text overlay. High quality 3D Pixar render style, cinematic lighting.
```

---

### מצב 5: חירום קיצוני (Critical / Emergency - פג תוקף היום!)
- **שם קובץ:** `widget_scene_5.png`
- **תיאור:** מאסקט בריצת אמוק מבוהלת, ידיים מורמות בהיסטריה מוחלטת, פה פעור לרווחה, טיפות זיעה מותזות בכל כיוון. רקע אדום וולקני של אזעקת חירום (Volcanic Alarm Red) עם ספוט אדום עוצמתי.
- **פרומפט מוכן:**
```text
Duolingo-style full-bleed mobile app widget background illustration (1:1 square). The image features the same cute 3D chubby royal-blue mascot character. State: Extreme Emergency (coupon expires TODAY!). The blue mascot is in total hysteria, running frantically with both hands flailing up in the air, mouth wide open screaming in terror, eyes bulging with panic, water droplets spraying around him. The character fills the lower 65% of the frame, anchored to the bottom edge. Volcanic glowing red ambient lighting illuminates his blue contours. Background is a dramatic deep blood-red, crimson, and volcanic dark burgundy gradient with glowing embers, alarm spotlight glow, and clean darker space at the top 35% for UI text overlay. High quality 3D Pixar render style.
```

---

## 4. איפה לשמור את הקבצים המופקים
שמור את 5 התמונות המוכנות בתיקייה:
`assets/mascot/`
בשמות:
- `widget_scene_1.png`
- `widget_scene_2.png`
- `widget_scene_3.png`
- `widget_scene_4.png`
- `widget_scene_5.png`
