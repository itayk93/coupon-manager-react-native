# Spec: ניוזלטר מהעלאת קובץ (teaser email + דף מלא מתארח)

**תאריך:** 2026-08-30
**סטטוס:** מאושר לעיצוב, ממתין לתוכנית מימוש
**נגזר מ:** סשן geo-analytics + טאב הניוזלטר לאדמין

---

## 0. תקציר בשפה פשוטה

**הבעיה:** היום כדי להכין ניוזלטר צריך להדביק HTML לתוך שדה טקסט (`custom_html`)
או לכתוב תוכן ידני (`content`). המשתמש רוצה במקום זה **להעלות קובץ** — עיצוב
שהוכן ב-Claude Design, עם תמונות, CSS, ואפילו JS — ולמחוק את עמודת `content`.

**האילוץ שקובע הכל:** לקוחות מייל (Gmail, Outlook, Apple Mail) **לא מריצים JS**,
חותכים `<style>`, לא תומכים ב-CSS מודרני, וחותכים מייל מעל ~102KB. **אי אפשר
לשלוח web bundle כגוף מייל.** ה-JS מת, רוב ה-CSS נשבר.

**הפתרון (מודל Substack/Beehiiv):**
- מעלים את קובץ העיצוב (ZIP או HTML בודד).
- הוא **מתארח כדף web** (Supabase Storage, public) — שם ה-JS והעיצוב המלא עובדים.
- ה-**מייל הוא teaser** email-safe קצר: כותרת + תמונת hero + פסקת פתיחה + כפתור
  "לצפייה המלאה" שמוביל לדף.
- בראש המייל: לינק "צפייה בדפדפן" → אותו דף מלא.
- הכותרת / תמונת ה-hero / פסקת הפתיחה **נשלפות אוטומטית** מה-HTML שהועלה. המשתמש
  יכול לדרוס.

**מה נמחק:** `newsletters.content`, `newsletters.custom_html`, `newsletters.main_title`.

---

## 1. מצב קיים

| רכיב | תפקיד |
|---|---|
| `newsletters` (טבלה) | `title, content, main_title, custom_html, newsletter_type, image_path, show_telegram_button, is_published, is_sent, sent_count, created_by, created_at` |
| `src/screens/admin/NewslettersTab.tsx` | list / create / edit / delete. שדות: כותרת, כותרת ראשית, סוג, תוכן, custom_html, toggle טלגרם |
| `src/hooks/useAdminManagement.ts` | `useNewsletters`, `useUpsertNewsletter`, `useDeleteNewsletter` |
| `supabase/functions/send-emails` mode `newsletter` | `handleNewsletter(id)` — שולח `nl.custom_html \|\| fallback` לכל המנויים, מסמן `is_sent`, כותב `newsletter_sendings` |
| `supabase/functions/newsletter-preview` | שולח ניוזלטר בודד לכתובת אחת (admin-gated). נבנה בסשן הזה. |
| `_shared/emailTemplate.ts` | 463 שורות. יש `multipassSummaryEmailHtml()`. |
| Storage bucket `profile-images` | public. דפוס: `supabase.storage.from(b).upload()` + `getPublicUrl()` |
| deps | `expo-file-system`, `expo-image-picker` מותקנים. **אין `expo-document-picker`.** |

---

## 2. מטרות ולא-מטרות

### מטרות
1. אדמין מעלה קובץ עיצוב (ZIP או `.html`) → הוא הופך לניוזלטר.
2. הקובץ מתארח כדף web ציבורי עם ה-JS/CSS/תמונות שלו שלמים.
3. המייל = teaser email-safe שנוצר מ-template קבוע + 3 שדות שנשלפים מהקובץ.
4. מוחקים `content`, `custom_html`, `main_title`.
5. שליחה (`send-emails` / `newsletter-preview`) עוברת ל-teaser.

### לא-מטרות (YAGNI)
- אין ניסיון לשחזר את העיצוב בתוך המייל (אין inliner, אין juice/premailer).
- אין בדיקות cross-client אוטומטיות (Litmus).
- אין עורך בלוקים.
- אין תמיכה ב-AMP for Email.
- אין גרסאות / היסטוריה של bundles — העלאה מחליפה.

---

## 3. ארכיטקטורה

```
┌───────────────┐  expo-document-picker   ┌────────────────────┐
│ NewslettersTab│────────────────────────▶│ newsletter-upload  │ (edge, admin-gated)
│   (admin)     │   ZIP / .html (base64)  │                    │
└───────────────┘                         │ 1. unzip (zip-js)  │
       ▲                                  │ 2. upload files -> │──▶ Storage bucket
       │  extracted fields                │    newsletters/<id>/│    "newsletters" (public)
       │  (subject, hero, preview)        │ 3. parse entry html│
       │                                  │    - <title>/<h1>  │
       │                                  │    - first <img>   │
       │                                  │    - first <p>     │
       │                                  │ 4. rewrite rel src │
       │                                  │    -> Storage URLs │
       └──────────────────────────────────│ 5. UPDATE newsletters row
                                          └────────────────────┘

send-emails (mode newsletter)  ─┐
newsletter-preview             ─┼──▶ newsletterTeaserEmailHtml({subject, heroImageUrl,
                                │        previewText, webUrl, unsubscribeUrl})
                                └──▶ Brevo
```

### 3.1 שינוי סכימה: `newsletters`

**מוסיפים:**
| עמודה | טיפוס | מקור |
|---|---|---|
| `bundle_path` | text | נתיב Storage לקובץ הכניסה, `newsletters/<id>/index.html` |
| `web_url` | text | URL ציבורי מלא לדף המתארח |
| `email_subject` | text | נושא המייל (נשלף מ-`<title>`/`<h1>`, ניתן לעריכה) |
| `hero_image_url` | text | URL מוחלט של תמונת ה-hero (נשלף מ-`<img>` ראשונה) |
| `preview_text` | text | טקסט פתיחה, ~200 תווים (נשלף מ-`<p>` ראשונה, ניתן לעריכה) |

**מוחקים:** `content`, `custom_html`, `main_title`.

**נשארים:** `id`, `title` (תווית פנימית לרשימת האדמין), `newsletter_type`,
`show_telegram_button`, `is_published`, `is_sent`, `sent_count`, `created_by`,
`created_at`. `image_path` — נמחק (מוחלף ב-`hero_image_url`).

**דאטה קיימת:** 3 ניוזלטרים היסטוריים + הניוזלטר הבדיקה id 24. אין להם `bundle_path`.
המיגרציה מוחקת את id 24 (בדיקה). ה-3 האחרים — נשארים בלי bundle; לא ניתנים לשליחה
עד העלאת קובץ (ה-teaser דורש `web_url`).

### 3.2 Storage bucket: `newsletters`

- `public = true` (הדף והתמונות נטענים בלי auth — ניוזלטר נועד לשיתוף).
- מבנה: `newsletters/<newsletter_id>/` — `index.html` + כל הנכסים בנתיבים היחסיים
  המקוריים.
- RLS: קריאה ציבורית; כתיבה — `service_role` בלבד (ה-edge function). האדמין **לא**
  מעלה ישירות ל-Storage; הוא שולח את הקובץ ל-`newsletter-upload` שמעלה בשמו.
- Content-Type: Supabase קובע לפי סיומת. `.html` → `text/html`, נטען בדפדפן.

### 3.3 Edge function: `newsletter-upload`

**Auth:** admin בלבד (`is_app_admin()` מ-JWT הקורא, כמו `newsletter-preview`).

**קלט:** JSON `{ newsletter_id: number, filename: string, content_base64: string }`.
`filename` נגמר ב-`.zip` או `.html`.

**לוגיקה:**
```
1. decode base64 -> bytes
2. if .zip:
     entries = unzip (jsr:@zip-js/zip-js)   // בזיכרון
     files = [{path, bytes}]
   if .html:
     files = [{path: 'index.html', bytes}]
3. entry = files.find(f => f.path === 'index.html')
          || files.find(f => f.path.endsWith('.html'))    // הראשון
   if !entry -> 400 "no html in bundle"
4. base = `newsletters/${newsletter_id}/`
   // מוחקים bundle קודם: storage.remove(list(base))
   for f of files:
     if f !== entry: storage.upload(base + f.path, f.bytes, {upsert:true})
5. html = new TextDecoder().decode(entry.bytes)
   dom = parse (deno-dom)                          // או regex fallback
   subject  = dom.querySelector('title')?.textContent
            || dom.querySelector('h1')?.textContent || ''
   firstImg = dom.querySelector('img')?.getAttribute('src') || null
   firstP   = dom.querySelector('p')?.textContent?.trim().slice(0, 200) || ''
6. // rewrite relative src/href -> absolute Storage URLs
   publicBase = `${SUPABASE_URL}/storage/v1/object/public/${base}`
   html = html.replace(/(src|href)=("|')(?!https?:|data:|mailto:|#)([^"']+)\2/g,
                       (_, a, q, p) => `${a}=${q}${publicBase}${p}${q}`)
   heroUrl = firstImg && !/^https?:|^data:/.test(firstImg)
           ? publicBase + firstImg.replace(/^\.?\//,'')
           : firstImg
7. storage.upload(base + 'index.html', html, {contentType:'text/html', upsert:true})
8. UPDATE newsletters SET
     bundle_path = base + 'index.html',
     web_url = publicBase + 'index.html',
     email_subject = coalesce(nullif(current.email_subject,''), subject),   // לא דורס עריכה ידנית
     hero_image_url = coalesce(nullif(current.hero_image_url,''), heroUrl),
     preview_text = coalesce(nullif(current.preview_text,''), firstP)
   WHERE id = newsletter_id
9. return { web_url, email_subject, hero_image_url, preview_text, file_count }
```

**תלות edge:** `jsr:@zip-js/zip-js` (unzip, ~קטן, Deno-native), `deno-dom` או
regex ל-parsing. שרת בלבד — לא נוגע ב-bundle של האפליקציה.

**גבולות:** ZIP עד 5MB (נאכף בקוד). אם גדול יותר → 413. תמונה בודדת מעל 1MB →
אזהרה ב-response (Gmail יחתוך אם ה-hero כבד).

### 3.4 Email template: `newsletterTeaserEmailHtml()`

מתווסף ל-`_shared/emailTemplate.ts`. table-based, inline styles, email-safe.

```
newsletterTeaserEmailHtml({
  subject: string,
  heroImageUrl: string | null,
  previewText: string,
  webUrl: string,
  unsubscribeUrl: string | null,
}): string
```

מבנה (RTL):
1. שורת "צפייה בדפדפן" זעירה (`<a href={webUrl}>`)
2. header עם שם המותג "קופון מאסטר"
3. `<img src={heroImageUrl}>` אם קיים — `width="100%" style="max-width:600px"`
4. `<h1>{subject}</h1>`
5. `<p>{previewText}</p>`
6. כפתור table-based → `{webUrl}` — "לצפייה המלאה"
7. footer + unsubscribe (משתמש ב-`wrapMarketingEmail` הקיים)

גודל יעד: < 40KB (הרבה מתחת ל-102KB של Gmail).

### 3.5 שינוי `send-emails` + `newsletter-preview`

`handleNewsletter(id)`:
```diff
- const html = await wrapMarketingEmail(
-   nl.custom_html || `<div dir="rtl"><h1>${nl.main_title || nl.title}</h1>${nl.content || ''}</div>`,
-   u.public_id, u.email);
- const ok = await sendEmail(u.email, nl.title, html, ...);
+ if (!nl.web_url) return jsonResponse({ error: 'לניוזלטר אין קובץ עיצוב' }, 400);
+ const html = await wrapMarketingEmail(
+   newsletterTeaserEmailHtml({
+     subject: nl.email_subject || nl.title,
+     heroImageUrl: nl.hero_image_url,
+     previewText: nl.preview_text || '',
+     webUrl: nl.web_url,
+     unsubscribeUrl: null,   // wrapMarketingEmail מוסיף בעצמו
+   }), u.public_id, u.email);
+ const ok = await sendEmail(u.email, nl.email_subject || nl.title, html, ...);
```
ה-`select` של הניוזלטר משתנה ל-`id,title,email_subject,hero_image_url,preview_text,web_url`.

`newsletter-preview` — אותו שינוי, בלי הלולאה.

### 3.6 שינוי `NewslettersTab.tsx`

מסירים את השדות: `content`, `custom_html`, `main_title`, `newsletter_type`.
מוסיפים:
- כפתור **"העלה קובץ עיצוב (ZIP או HTML)"** → `expo-document-picker`
  (`getDocumentAsync({ type: ['application/zip','text/html'] })`) → קורא כ-base64
  (`expo-file-system`) → `supabase.functions.invoke('newsletter-upload', { body })`.
- אחרי העלאה: מציג `email_subject` (input), thumbnail של `hero_image_url`,
  `preview_text` (textarea) — כולם editable → נשמרים דרך `useUpsertNewsletter`.
- לינק **"צפייה בדף המלא"** → `web_url` (פותח דפדפן).
- נשארים: `title` (תווית פנימית), toggle `show_telegram_button`.
- כרטיס ברשימה: מציג אם יש `web_url` ("מוכן") או לא ("חסר קובץ").

**תלות חדשה:** `expo-document-picker` (~`expo` module, JS זעיר). לפי CLAUDE.md —
לבדוק גודל לפני התקנה ולציין בתשובה.

### 3.7 מיגרציות

1. `newsletters_file_upload_columns` — ADD 5 עמודות, DROP `content`/`custom_html`/
   `main_title`/`image_path`, DELETE ניוזלטר בדיקה id 24.
2. `newsletters_storage_bucket` — `storage.create_bucket('newsletters', public=true)`
   + policy קריאה ציבורית + policy כתיבה `service_role`.
3. `types.ts` — עדכון בלוק `newsletters` (ידני, כמו כל הסשן).

---

## 4. זרימת נתונים

### 4.1 יצירה + העלאה
1. אדמין → "ניוזלטר חדש" → `useUpsertNewsletter` insert (רק `title`) → id 25.
2. אדמין → "העלה קובץ" → בוחר `design.zip` מ-Claude Design.
3. הקובץ נקרא base64 → `newsletter-upload({ newsletter_id: 25, filename, content_base64 })`.
4. edge: unzip → `newsletters/25/index.html` + `newsletters/25/assets/*` ל-Storage.
5. edge: שולף `<title>`="מבצעי קיץ", `<img>` ראשונה, `<p>` ראשונה. משכתב src יחסי.
6. `newsletters` row 25 מתעדכן. response חוזר עם השדות.
7. הטאב מציג: subject, hero thumbnail, preview text — אדמין עורך אם צריך.

### 4.2 תצוגה מקדימה
`newsletter-preview({ newsletter_id: 25, to: 'itayk93@gmail.com' })` →
`newsletterTeaserEmailHtml(...)` → Brevo. הכפתור במייל → `web_url` → הדף המלא.

### 4.3 שליחה לכולם
`send-emails({ mode: 'newsletter', newsletter_id: 25 })` → אותו teaser לכל מנוי.

---

## 5. טיפול בשגיאות

| מצב | התנהגות |
|---|---|
| ZIP בלי `.html` | 400 "no html in bundle" |
| ZIP > 5MB | 413 |
| קובץ לא zip/html | 400 |
| `<img>`/`<p>`/`<title>` חסרים | השדה נשאר ריק; אדמין ממלא ידנית |
| שליחה של ניוזלטר בלי `web_url` | 400 "לניוזלטר אין קובץ עיצוב" |
| Storage upload נכשל באמצע | edge מחזיר 502; הניוזלטר נשאר בלי `web_url` (לא ניתן לשליחה) |
| `hero_image_url` שבור בזמן שליחה | המייל נשלח בלי תמונה (alt text); לא חוסם |

---

## 6. טסטים

| יחידה | טסט |
|---|---|
| `newsletter-upload` | ZIP עם index.html + image → Storage מכיל את שניהם, row מתעדכן, src יחסי שוכתב ל-URL מוחלט |
| `newsletter-upload` | `.html` בודד → מתארח, שדות נשלפים |
| `newsletter-upload` | ZIP בלי html → 400 |
| `newsletter-upload` | לא-אדמין → 403 |
| `newsletter-upload` | שדה שכבר נערך ידנית → לא נדרס בהעלאה חוזרת |
| `newsletterTeaserEmailHtml` | פלט מכיל `webUrl`, `heroImageUrl`, `previewText`, שורת "צפייה בדפדפן"; < 40KB; אין `<script>` |
| `send-emails` newsletter | ניוזלטר עם `web_url` → teaser נשלח; בלי → 400 |
| migration | אחרי drop: `tsc` נקי, `vitest` ירוק, `npm run size` בתקציב |
| `NewslettersTab` | בוחר קובץ → invoke נקרא עם base64; response ממלא את השדות |

מיקום: `scripts/e2e-newsletter.mjs` (מודל `e2e-referral.mjs`) + טסטי יחידה
ל-template.

---

## 7. השפעה על תקציבים (CLAUDE.md)

| תקציב | לפני | אחרי |
|---|---|---|
| JS bundle | 7.8MB | +`expo-document-picker` (~זעיר, לאמת ב-`npm run size`) |
| נכסים | 4.2MB | ללא שינוי |
| `newsletters` טבלה | 13 עמודות | 14 (−4: content/custom_html/main_title/image_path, +5), טקסט קצר במקום HTML גדול |
| Storage | bucket אחד | +`newsletters` bucket (bundles, נשלטים ע"י מחיקת ניוזלטר) |

`newsletter-upload` הוא edge (שרת) — unzip lib לא בבאנדל.

---

## 8. סיכונים פתוחים

| סיכון | מיטיגציה |
|---|---|
| Claude Design מייצא HTML שלא נטען טוב מ-Storage (base href, module scripts) | הדף המלא נטען ב-`web_url`; אם שבור, אדמין רואה ב"צפייה בדף" לפני שליחה |
| שכתוב src יחסי ב-regex לא מושלם (CSS `url()`, `srcset`) | MVP: `src`/`href` בלבד. CSS `url()` — לוג אזהרה. Claude Design לרוב inline או data-URI |
| הדף ציבורי — כל מי שיש לו את ה-URL רואה | זו המטרה (ניוזלטר לשיתוף). לא לשים שם מידע רגיש |
| `expo-document-picker` על web (expo web) | ה-picker עובד ב-web; לאמת בהרצה |
| מחיקת ניוזלטר לא מנקה את ה-Storage | `useDeleteNewsletter` → קריאה ל-`newsletter-upload` mode delete, או trigger `storage.delete` |

---

## 9. הגדרת "בוצע"

- [ ] 2 מיגרציות + עדכון `types.ts`; `content`/`custom_html`/`main_title` נמחקו.
- [ ] bucket `newsletters` קיים, public read, service_role write.
- [ ] `newsletter-upload` פרוס; ZIP מ-Claude Design → דף מתארח + 3 שדות נשלפים.
- [ ] `newsletterTeaserEmailHtml` ב-`emailTemplate.ts` + טסט.
- [ ] `send-emails` + `newsletter-preview` שולחים teaser.
- [ ] `NewslettersTab` — file picker, שדות editable, לינק לדף.
- [ ] מחיקת ניוזלטר מנקה את ה-Storage.
- [ ] `e2e-newsletter.mjs` עובר.
- [ ] `tsc` נקי · `vitest` ירוק · `npm run size` בתקציב.
- [ ] תיעוד: עדכון session doc.
