# Spec: Geo Analytics + שימור IP מבוקר

**תאריך:** 2026-08-30
**סטטוס:** מאושר לעיצוב, ממתין לתוכנית מימוש
**נגזר מ:** סשן ביקורת עמודות DB ([SESSION_2026-08-29_DB_UNUSED_COLUMNS_AUDIT.md](../../SESSION_2026-08-29_DB_UNUSED_COLUMNS_AUDIT.md))

---

## 0. תקציר בשפה פשוטה

**הבעיה:** האפליקציה מתעדת כל פעולה של משתמש (איזה מסך פתח, איזה קופון צפה,
מאיזה מכשיר) בטבלה `user_activities` — היום 30,900 רשומות. פעם, כשהיה באקאנד
Python, הוא היה מעשיר כל רשומה עם מיקום גיאוגרפי (עיר, אזור) לפי כתובת ה-IP.
ה-Python ירד מהאוויר. מאז שדות המיקום נשארים ריקים בכל רשומה חדשה.

**מה רוצים:**
1. **אנליטיקה** — לראות "כמה משתמשים מתל-אביב מול חיפה" במסך אדמין.
2. **מניעת הונאה בהפניות** — לזהות כשכמה חשבונות "מזויפים" נרשמים מאותו ISP/אזור
   כדי לגזול תגמולי הפניה.

**האילוצים:**
- חינם. בלי מנוי לשירות מיקום.
- מדויק ככל האפשר (רמת עיר).
- כתובת IP היא מידע אישי (PII). שומרים אותה רק לזמן קצר — מספיק כדי לוודא
  שההפניות תקינות — ואז מוחקים. עיר/אזור נשארים לנצח (הם לא מזהים אדם).
- כל החלטה כאן חייבת להיכתב במדיניות הפרטיות של האפליקציה.

**הפתרון בקצרה:**
- טבלת עזר `ip_geo` שממירה כתובת IP → עיר/אזור/ISP. מתמלאת פעם אחת לכל IP.
- פונקציית שרת (`enrich-ip-geo`) שרצה כל רבע שעה, לוקחת כתובות IP חדשות, שולחת
  אותן לשירות מיקום חינמי, ושומרת את התוצאה — גם בטבלת העזר וגם **צורבת את
  העיר/אזור ישירות על רשומת הפעילות** (כדי שהמידע ישרוד גם אחרי שה-IP יימחק).
- פונקציית שרת יומית שמוחקת כתובות IP מרשומות בנות יותר מ-90 יום.
- מסך אדמין חדש שמראה פילוח לפי עיר/אזור.
- שדרוג לפונקציית זיהוי ההונאה הקיימת.
- עדכון מדיניות הפרטיות.

---

## 1. רקע ומצב קיים

### 1.1 מה קורה היום

| רכיב | תפקיד |
|---|---|
| `src/lib/activityLog.ts` | תור fire-and-forget באפליקציה. אוסף אירועים, שולח כל 10 שניות. |
| `supabase/functions/log-activity` | Edge function. מקבל אצווה, כותב ל-`user_activities`. |
| `user_activities` | 30,906 שורות. גדל ~130/יום. **אין מדיניות שימור — גדל לנצח.** |
| `referral_fraud_reasons()` | פונקציית DB. כבר עושה JOIN ל-`user_activities` על `ip_address` בשביל סיגנל `ip_burst`. |

### 1.2 מה `log-activity` כותב היום

```
user_id, action, coupon_id, timestamp, ip_address, device, country_code, extra_metadata
```

`country_code` מגיע חינם מ-header של Cloudflare (`cf-ipcountry`). כל שאר שדות
המיקום (`city`, `region`, `country`, `lat`, `timezone`) — **NULL בכל רשומה חדשה**
כי הקוד מסרב במפורש לקריאת geo-IP חיצונית לכל אירוע.

### 1.3 מצב הנתונים ב-`user_activities` (16 עמודות)

| עמודה | מלא ב־ | הערה |
|---|---|---|
| `activity_id`, `user_id`, `action`, `coupon_id`, `timestamp` | 100% | ליבת האירוע |
| `ip_address` | 66% (20,388) | PII |
| `device` | 100% | סוג מכשיר |
| `browser` | 97% | **Python כתב, RN לא. הולך ומתיישן.** |
| `duration` | **0%** | תמיד NULL/0. מת. |
| `extra_metadata` | — | jsonb, מכיל `screen` לניווט |
| `city`, `region`, `country` | 52% (16,203) | היסטורי מ-Python |
| `country_code` | 48% (14,709) | חלקו Python, חלקו CF |
| `lat` | 48% | `lon` כבר נמחק בטיר 1 → חצי-שבור |
| `timezone` | 48% | היסטורי |

---

## 2. מטרות ולא-מטרות

### מטרות
1. שדות `city` + `region` יתמלאו אוטומטית ברשומות חדשות, בחינם.
2. מסך אדמין: פילוח משתמשים/אירועים לפי עיר ואזור, טווח 30/90 יום.
3. סיגנל הונאה חדש: זיהוי ריכוז חשבונות מופנים לפי ASN (ספק תקשורת).
4. שימור מבוקר: `ip_address` נמחק אחרי 90 יום. `city`/`region`/`action` נשמרים לנצח.
5. מדיניות פרטיות מעודכנת.
6. ניקוי: מחיקת עמודות מתות (`duration`, `browser`, `lat`, `timezone`, `country`).

### לא-מטרות (YAGNI)
- אין `lat`/`lon`, אין מפת חום. עיר/אזור טקסט בלבד.
- אין geo-lookup לכל אירוע — רק דרך cache + cron.
- אין סיגנל `region_burst` (חלש, נוטה ל-false positive).
- אין מסך שמציג כתובת IP גולמית.
- אין backfill של דיוק — השורות הישנות מקבלות את מה שכבר יש בהן.

---

## 3. ארכיטקטורה — יחידות ואחריות

```
┌─────────────┐   batch 10s   ┌──────────────┐   INSERT    ┌──────────────────┐
│ activityLog │──────────────▶│ log-activity │────────────▶│  user_activities │
│  (app)      │               │  (edge)      │             │  + city/region   │◀──┐
└─────────────┘               └──────────────┘             │    (צרובות)      │   │
                                                           └──────────────────┘   │
                                                                    │             │
                          ┌─────────────────┐   cron 15m             │ SELECT      │ UPDATE
                          │  enrich-ip-geo  │◀──────────────────────┘ IPs חדשים   │ city,region
                          │    (edge)       │                                      │
                          │                 │   ipinfo.io → fallback ipwho.is      │
                          │                 │──────────────────────────────────────┘
                          │                 │   UPSERT
                          │                 │────────────▶┌──────────┐
                          └─────────────────┘             │  ip_geo  │  (dedup + isp/asn ל-fraud)
                                                          └──────────┘
                          ┌─────────────────┐   cron יומי       │
                          │  strip-old-ip   │──────────────────▶│ NULL ip_address > 90d
                          │    (edge/SQL)   │                   │ DELETE ip_geo יתומים
                          └─────────────────┘

    admin tab ──▶ useGeoAnalytics ──▶ RPC admin_geo_breakdown(days) ──▶ user_activities GROUP BY region,city
    referral_fraud_reasons() ──▶ JOIN ip_geo ──▶ סיגנל asn_burst
```

### 3.1 טבלה חדשה: `ip_geo`

**בשפה פשוטה:** מילון שמתרגם כתובת IP למיקום. כל כתובת מופיעה פעם אחת. נגזם
אחרי 90 יום כי כל מה שצריך לשמור ממנו לטווח ארוך (עיר/אזור) כבר הועתק לרשומות
הפעילות עצמן.

```sql
create table public.ip_geo (
  ip_address    text primary key,
  city          text,
  region        text,
  country_code  text,
  isp           text,
  asn           text,                         -- מספר מערכת אוטונומית, לזיהוי ספק
  source        text not null,                -- 'ipinfo' | 'ipwho' | 'legacy'
  resolved_at   timestamptz not null default now(),
  lookup_failed boolean not null default false
);
```

- **אין FK** ל-`user_activities` — זה lookup לפי ערך, לא יחס.
- `lookup_failed` — כדי לא לנסות שוב ושוב כתובת פרטית/שמורה שאף ספק לא מזהה.
- **RLS:** service_role בלבד (הפונקציות). אין קריאה מהאפליקציה.

### 3.2 Edge function: `enrich-ip-geo`

**בשפה פשוטה:** רץ כל רבע שעה. מוצא כתובות IP שהופיעו בפעילות אבל עוד לא תורגמו,
שולח כל אחת לשירות מיקום, שומר תוצאה בשני מקומות: במילון `ip_geo` ובשורות
הפעילות עצמן.

**קלט:** אין. מופעל ע"י pg_cron דרך `net.http_post` לכתובת ה-edge function —
אותו דפוס בדיוק כמו `trigger_hourly_multipass_update` הקיים בריפו.

**לוגיקה:**
```
1. rows = SELECT DISTINCT ip_address FROM user_activities
          WHERE ip_address IS NOT NULL
            AND ip_address NOT IN (SELECT ip_address FROM ip_geo WHERE NOT lookup_failed)
          LIMIT 40
2. לכל ip ב-rows:
   a. res = ipinfo.io/{ip}?token=...   (timeout 4s)
   b. אם נכשל: res = ipwho.is/{ip}       (fallback)
   c. אם שניהם נכשלו: UPSERT ip_geo(ip, lookup_failed=true, source='none'); continue
   d. UPSERT ip_geo(ip, city, region, country_code, isp, asn, source, resolved_at=now())
   e. UPDATE user_activities SET city=res.city, region=res.region
      WHERE ip_address = ip AND city IS NULL
   f. sleep 150ms   (כיבוד rate-limit)
3. log: {resolved: N, failed: M}
```

**ספק ראשי — `ipinfo.io` Lite:**
- חינם, 50,000 בקשות/חודש, token כ-secret (`IPINFO_TOKEN`).
- HTTPS, נתוני ASN טובים.
- מחזיר: `city`, `region`, `country`, `org` (=`"AS#### שם ספק"` → פיצול ל-`asn` + `isp`), `timezone`.
- נפח בפועל: ~500 IPs ייחודיים בהיסטוריה + ~30 חדשים/חודש → פי 100 מתחת למכסה.

**Fallback — `ipwho.is`:**
- חינם, בלי key, HTTPS, fair-use.
- מחזיר: `city`, `region`, `country_code`, `connection.isp`, `connection.asn`.

**כשל כפול:** `lookup_failed=true`, ניסיון חוזר אחרי 7 יום (השאילתה בשלב 1
מסננת `WHERE NOT lookup_failed`; job שבועי מאפס `lookup_failed` לרשומות ישנות מ-7 יום).

**Re-resolve:** job שמוסיף לתור IPs עם `resolved_at < now() - 90 days` (כתובות מתחלפות).

### 3.3 שינוי סכימה: `user_activities`

**נשאר קבוע (לנצח):**
`activity_id`, `user_id`, `action`, `coupon_id`, `timestamp`, `device`,
`country_code`, **`city`**, **`region`**

**נשאר זמני (נמחק אחרי 90 יום):**
`ip_address`, `extra_metadata`

**נמחק (מיגרציה):**
| עמודה | סיבה |
|---|---|
| `duration` | תמיד 0. מעולם לא נכתב. |
| `browser` | RN לא כותב. הולך ומתיישן. |
| `country` | כפילות של `country_code`. |
| `lat` | `lon` כבר נמחק → חסר משמעות. אין מפה ב-YAGNI. |
| `timezone` | לא בשימוש, לא נכתב. |

**אינדקס חדש:**
```sql
create index idx_user_activities_ip on public.user_activities (ip_address)
  where ip_address is not null;
```
**בשפה פשוטה:** בלי זה, כל בדיקת הונאה סורקת את כל הטבלה. עם זה — קפיצה ישירה.
צריך בכל מקרה, בלי קשר לפיצ'ר.

תוצאה: 16 → 11 עמודות.

**Backfill חינם לפני מחיקת העמודות:**
```sql
insert into public.ip_geo (ip_address, city, region, country_code, source, resolved_at)
select distinct on (ip_address)
       ip_address, city, region, country_code, 'legacy', now()
from public.user_activities
where ip_address is not null and city is not null
order by ip_address, "timestamp" desc
on conflict (ip_address) do nothing;
```
16,203 השורות ההיסטוריות כבר מכילות `city`/`region` — הן נשארות על השורה
(לא נמחקות), וגם מזינות את `ip_geo` בחינם.

### 3.4 Cron יומי: `strip-old-ip`

**בשפה פשוטה:** פעם ביום מוחק כתובות IP מרשומות ישנות מ-90 יום, ומנקה מהמילון
כתובות שכבר לא בשימוש.

**מימוש:** SQL טהור — פונקציית DB `strip_old_activity_ip()` שנקראת ישירות
מ-pg_cron. אין edge function (אין קריאה חיצונית, הכל בתוך ה-DB).

```sql
-- שלב 1: הסרת PII מרשומות ישנות
update public.user_activities
set ip_address = null, extra_metadata = null
where "timestamp" < now() - interval '90 days'
  and ip_address is not null;

-- שלב 2: ניקוי מילון יתומים
delete from public.ip_geo g
where g.resolved_at < now() - interval '90 days'
  and not exists (
    select 1 from public.user_activities ua where ua.ip_address = g.ip_address
  );
```

**למה 90 יום:** ההונאה בהפניות נבדקת בחלון של 14 יום (שיוך) + 24 שעות (burst).
90 יום נותנים מרווח נדיב לחקירה ידנית ועדיין מגבילים את חשיפת ה-PII.

### 3.5 שדרוג `referral_fraud_reasons()`

**בשפה פשוטה:** הפונקציה כבר מזהה "5+ חשבונות מאותה כתובת IP". מתחמקים מזה
בקלות עם רשת סלולרית (כל אחד מקבל IP אחר). הסיגנל החדש מזהה "8+ חשבונות מאותו
**ספק תקשורת** (ASN) באותו יום" — קשה יותר לזייף.

- `ip_burst` הקיים — ללא שינוי.
- **`asn_burst` חדש:**
  ```sql
  select count(distinct b.referred_user_id) into n
  from public.referrals a
  join public.user_activities ua_a on ua_a.user_id = a.referred_user_id
  join public.ip_geo geo_a on geo_a.ip_address = ua_a.ip_address
  join public.ip_geo geo_b on geo_b.asn = geo_a.asn
  join public.user_activities ua_b on ua_b.ip_address = geo_b.ip_address
  join public.referrals b on b.referred_user_id = ua_b.user_id
  where a.id = p_referral_id
    and geo_a.asn is not null
    and geo_a.asn <> all (array['AS8551','AS12400','AS1680','AS16116','AS8867'])  -- ISP ביתי גדול IL
    and b.campaign_id = r.campaign_id
    and abs(extract(epoch from (b.registered_at - r.registered_at))) < 86400;
  if n >= 8 then reasons := reasons || 'asn_burst'; end if;
  ```
- **הגנה מ-false positive:** סף 8 (לא 5) + allowlist של ASNs של Bezeq / Partner /
  Cellcom / HOT / 012 שבהם הסיגנל מושתק (חצי מדינה על אותו ASN).
- הרשימה המדויקת של ה-ASNs תיקבע בזמן המימוש מול נתוני `ip_geo` אמיתיים.

### 3.6 מסך אדמין: Geo Analytics

**בשפה פשוטה:** טאב חדש בלוח האדמין. טבלה: "אזור | עיר | משתמשים | אירועים",
ממוינת יורד, עם בורר טווח 30/90 יום.

- `src/screens/admin/AdminDashboardScreen.tsx` — `TAB_KEYS` += `"geo"`, כפתור טאב חדש.
- `src/screens/admin/GeoAnalyticsTab.tsx` — קומפוננט חדש.
- `src/hooks/useGeoAnalytics.ts` — hook חדש, קורא RPC.
- **RPC חדש** `admin_geo_breakdown(p_days integer)`:
  ```sql
  create function public.admin_geo_breakdown(p_days integer)
  returns table (region text, city text, users bigint, events bigint)
  language sql stable security definer set search_path = public, pg_temp
  as $$
    select coalesce(region, 'לא ידוע'), coalesce(city, 'לא ידוע'),
           count(distinct user_id), count(*)
    from public.user_activities
    where "timestamp" > now() - (p_days || ' days')::interval
    group by 1, 2
    order by 3 desc
    limit 200;
  $$;
  ```
  - `SECURITY DEFINER` + בדיקת אדמין בתחילת הפונקציה (כמו כל `referral_*`).
  - `EXECUTE` ל-`authenticated` בלבד, נבדק מול `is_app_admin()`.
  - **אין JOIN** — `city`/`region` צרובות על השורה.

### 3.7 מדיניות פרטיות — `src/screens/content/PrivacyScreen.tsx`

**חובה.** סעיף חדש (סעיף 4), ותיקון סעיף 2 הקיים.

תוכן הסעיף החדש (טיוטה, ניסוח סופי במימוש):

> **4. תיעוד פעילות ומיקום**
> כדי לשפר את המוצר ולמנוע ניצול לרעה של תוכנית ההפניות, אנו רושמים פעולות
> בסיסיות באפליקציה: מסכים שנצפו, פעולות על קופונים, סוג המכשיר, וכתובת ה-IP
> שממנה בוצעה הפעולה.
> **כתובת ה-IP נשמרת עד 90 יום ואז נמחקת.** מתוך כתובת ה-IP אנו גוזרים עיר ואזור
> כלליים (למשל "תל אביב", "מחוז חיפה") — נתונים אלה, שאינם מזהים אותך אישית,
> נשמרים לצורך ניתוח סטטיסטי.
> לצורך גזירת המיקום, כתובת ה-IP נשלחת לשירות geolocation חיצוני. לא נשלח אליו
> מידע מזהה אחר.

תיקון סעיף 2: להחליף
> "איננו מוכרים או משתפים את המידע שלך עם גורמים מסחריים צד שלישי."
ב־
> "איננו מוכרים את המידע שלך. איננו משתפים אותו עם צד שלישי, למעט שירותי תשתית
> חיוניים (אירוח, שליחת דוא"ל, גזירת מיקום מכתובת IP) הפועלים לפי הוראותינו."

בדוק אם `ReferralTermsScreen.tsx` צריך משפט על זיהוי הונאה — כנראה כן.

---

## 4. זרימת נתונים — תרחישים

### 4.1 אירוע חדש נכנס
1. משתמש פותח מסך → `activityLog.ts` מוסיף לתור.
2. אחרי 10ש' → `flushActivityLog` → `POST /log-activity`.
3. `log-activity` כותב שורה: `city=NULL, region=NULL, ip_address='1.2.3.4'`.

### 4.2 העשרה (רבע שעה אחרי)
1. `enrich-ip-geo` cron רץ.
2. מוצא `1.2.3.4` — לא ב-`ip_geo`.
3. `ipinfo.io/1.2.3.4` → `{city:"Tel Aviv", region:"Tel Aviv District", org:"AS12400 Partner"}`.
4. `UPSERT ip_geo('1.2.3.4', 'Tel Aviv', 'Tel Aviv District', 'IL', 'Partner', 'AS12400', 'ipinfo')`.
5. `UPDATE user_activities SET city='Tel Aviv', region='Tel Aviv District' WHERE ip_address='1.2.3.4' AND city IS NULL` → כל השורות של אותו IP מתמלאות בבת אחת.

### 4.3 שימור (90 יום אחרי)
1. `strip-old-ip` cron רץ.
2. `UPDATE ... SET ip_address=NULL, extra_metadata=NULL WHERE timestamp < now()-90d`.
3. השורה נשארת: `action='view_coupon', city='Tel Aviv', region='Tel Aviv District', ip_address=NULL`.
4. `ip_geo('1.2.3.4')` נמחק אם אף שורה חיה כבר לא מפנה אליו.

### 4.4 אנליטיקה
1. אדמין פותח טאב Geo → `useGeoAnalytics(90)` → RPC `admin_geo_breakdown(90)`.
2. `GROUP BY region, city` על 90 יום אחרונים → טבלה ממוינת.

### 4.5 בדיקת הונאה
1. אדמין / cron מריץ `referral_fraud_reasons(referral_id)`.
2. `asn_burst` JOIN ל-`ip_geo` → סופר משתמשים מופנים באותו ASN תוך 24ש'.
3. אם ≥8 ולא ISP ביתי גדול → `reasons += 'asn_burst'`.

---

## 5. טיפול בשגיאות

| מצב | התנהגות |
|---|---|
| `ipinfo.io` נפל / timeout | fallback ל-`ipwho.is` |
| שני הספקים נפלו | `ip_geo(lookup_failed=true)`, המשך לשורה הבאה, retry אחרי 7 יום |
| IP פרטי / שמור (10.x, 192.168.x) | הספקים מחזירים "bogon" → `lookup_failed=true`. אנליטיקה: bucket "לא ידוע". |
| IP טרם הועשר (הרשומה בת פחות מ-15 דק') | `city=NULL` → bucket "לא ידוע" זמנית, יתמלא ב-cron הבא |
| `log-activity` נכשל | ללא שינוי — כבר fire-and-forget, זורק את האצווה |
| RPC אדמין נקרא ע"י לא-אדמין | `raise exception` / return ריק |
| חריגה ממכסת `ipinfo` (50k/חודש) | לא אמור לקרות בנפח הזה. אם כן — `enrich-ip-geo` עובר ל-`ipwho.is` בלבד עד תחילת החודש. |

---

## 6. טסטים

| יחידה | טסט |
|---|---|
| `enrich-ip-geo` | mock תגובת `ipinfo` תקינה → `ip_geo` + `user_activities` מתעדכנים |
| `enrich-ip-geo` | mock `ipinfo` 500 → `ipwho` נקרא → upsert מ-fallback |
| `enrich-ip-geo` | שני הספקים 500 → `lookup_failed=true`, אין crash |
| `enrich-ip-geo` | IP כבר ב-`ip_geo` → לא נקרא ספק |
| `strip-old-ip` | שורה בת 100 יום → `ip_address` מתאפס; שורה בת 10 יום → לא נגעו; `city` נשאר בשתיהן |
| `strip-old-ip` | `ip_geo` שאף שורה חיה לא מפנה אליו → נמחק; אחד שכן → נשאר |
| `admin_geo_breakdown` | seed 3 ערים → grouping + מיון נכונים |
| `admin_geo_breakdown` | נקרא ע"י `authenticated` לא-אדמין → נדחה |
| `referral_fraud_reasons` | 8 מופנים באותו ASN תוך 24ש' → `asn_burst` נורה |
| `referral_fraud_reasons` | 10 מופנים על ASN של Bezeq → `asn_burst` **לא** נורה (allowlist) |
| `referral_fraud_reasons` | `ip_burst` הקיים → עדיין עובד אחרי השינוי |
| migration | לאחר drop: `tsc` נקי, `vitest` ירוק, `npm run size` בתקציב |

מיקום: `scripts/e2e-*.mjs` (כמו `e2e-referral.mjs`) + `supabase/tests/` ל-SQL טהור.

---

## 7. מיגרציות (סדר)

1. `create_ip_geo_table` — טבלה + RLS + אינדקסים.
2. `backfill_ip_geo_from_legacy` — INSERT מ-`user_activities` הקיים.
3. `user_activities_geo_cleanup` — אינדקס `idx_user_activities_ip` + DROP `duration, browser, country, lat, timezone`.
4. `admin_geo_breakdown_rpc` — פונקציה + GRANT.
5. `referral_fraud_asn_burst` — CREATE OR REPLACE `referral_fraud_reasons`.
6. pg_cron:
   - `enrich-ip-geo` (כל 15 דק') — `net.http_post` ל-edge function, כדפוס `trigger_hourly_multipass_update`.
   - `strip_old_activity_ip()` (יומי 03:00) — קריאת SQL ישירה.
   - `reset_failed_ip_lookups()` (שבועי) — קריאת SQL ישירה, מאפס `lookup_failed` לרשומות בנות >7 יום.

**פיזור:** מותר לחלק לשתי תוכניות מימוש — (א) `ip_geo` + enrichment + retention,
(ב) טאב אדמין + `asn_burst` + מדיניות פרטיות. (א) חייב לקדום את (ב).

כל מיגרציה = קובץ מקומי ב-`supabase/migrations/` + הרצה. שם קובץ מיושר לגרסת remote.

---

## 8. השפעה על תקציבים (CLAUDE.md)

| תקציב | לפני | אחרי | הערה |
|---|---|---|---|
| JS bundle | 7.8MB | ~7.8MB | +hook +tab, זניח |
| נכסים | 4.2MB | 4.2MB | אין |
| אחסון מכשיר | — | — | הכל צד-שרת |
| טבלת `user_activities` | 16 עמודות, גדל לנצח | 11 עמודות, IP נגזם 90 יום | **קטן יותר** |
| `ip_geo` | — | חדש, ~500 שורות, נגזם | זניח |

התאמה ל"האפליקציה חייבת להישאר קלה": הפיצ'ר **מקטין** את משקל ה-DB ולא מוסיף
תלות client. ה-edge functions הן קוד שרת, לא בבאנדל.

---

## 9. סיכונים פתוחים

| סיכון | מיטיגציה |
|---|---|
| דיוק geo-IP חינמי ~55-80% ברמת עיר, גרוע יותר בסלולר | מקבלים. זו אנליטיקה, לא חיוב. "לא ידוע" הוא bucket לגיטימי. |
| allowlist ASN לא שלם → false positive ב-`asn_burst` | סף 8, לא 5. נכוונן מול נתוני אמת. הסיגנל מייעץ, לא חוסם — אדמין מאשר. |
| `ipinfo` משנה תנאי tier חינמי | fallback `ipwho.is` כבר בקוד. החלפת ספק = שינוי בפונקציה אחת. |
| משתמש מוחק חשבון — מה עם `user_activities`? | לבדוק את `useConsent.ts` (מוחק `coupon`/`notifications`). להוסיף מחיקת `user_activities` של המשתמש ל-signOut/delete. |

---

## 10. הגדרת "בוצע"

- [ ] 6 מיגרציות רצות, קבצים מקומיים מיושרים ל-remote.
- [ ] `enrich-ip-geo` + `strip-old-ip` פרוסות, cron רשום, run ראשון ירוק.
- [ ] רשומה חדשה מקבלת `city`/`region` תוך ≤15 דק'.
- [ ] טאב Geo באדמין מציג פילוח אמיתי.
- [ ] `referral_fraud_reasons` מחזיר `asn_burst` בתרחיש הטסט.
- [ ] מדיניות הפרטיות מעודכנת ומוצגת באפליקציה.
- [ ] `tsc` נקי, `vitest` ירוק, `npm run size` בתקציב.
- [ ] מחיקת `user_activities` של משתמש נוספת לזרימת מחיקת חשבון.
- [ ] תיעוד: עדכון `SESSION_2026-08-29_DB_UNUSED_COLUMNS_AUDIT.md` סעיף "שלבים הבאים".
