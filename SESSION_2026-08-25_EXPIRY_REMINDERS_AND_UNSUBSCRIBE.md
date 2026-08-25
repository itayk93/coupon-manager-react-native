# Expiry reminders and the unsubscribe flow — 2026-08-25

Session record: what was asked, what was decided and why, what was verified, and
what is still open. Three pieces of work, in the order they came up.

| Commit | What |
| --- | --- |
| `48af4f4` | Dismissible expiring-coupons banner on the dashboard |
| `e4e4d68` | Daily expiry reminders inside the final stretch |
| `a92ad0e` | The email unsubscribe link reaches a real preference centre |
| `d645c5f` | Email links open the installed app or PWA instead of the browser |

---

## 1. Dashboard: drop one stat tile, add an expiry banner

### The ask

Remove the "חסכת עד היום" tile. Put a dismissible alert at the top of the
dashboard when a coupon is about to expire; it comes back the next day with an
updated day count. Decide what to do when several coupons qualify. Research how
comparable apps handle it before building.

### What the research said

- A **persistent top banner** is the right level of interruption for something
  time-sensitive that is not blocking. A modal is too much for "expires in 10
  days". ([saasui](https://www.saasui.design/blog/saas-notification-toast-ux-patterns),
  [eleken](https://www.eleken.co/blog-posts/alert-ui-examples))
- **Escalation**: the higher the risk, the louder the interruption. Colour
  should track urgency instead of staying fixed.
- **"Remind me later" beats a final dismiss** — snooze rather than a permanent
  close. ([GitLab renewal banner](https://gitlab.com/gitlab-org/gitlab/-/issues/238065))
- **Group, do not stack**: one banner, the most urgent item in the headline,
  "and N more" behind it.
- **A dashboard is a natural pause point**, the right place for a banner.
- **Cap at one appearance per day.** ([uxcam](https://uxcam.com/blog/push-notification-guide/))

### Decisions

| Decision | Why |
| --- | --- |
| Window of 14 days | Matches the "פגים ב-14 יום" tile already on the dashboard. One definition of "soon" across the app. |
| Colour by the most urgent coupon (≤3 red, 4–7 amber, 8–14 neutral) | Escalation. A fixed colour trains the user to ignore it. |
| One coupon → open it. Several → expand an inline list (3 rows + "and N more") | Avoids a routing change and keeps the banner self-contained. A stack of banners was rejected outright. |
| Dismissal lasts for the rest of the local calendar day | The point of the reminder is the falling day count; a permanent dismiss defeats it. |
| Escalation exception: a coupon dropping to ≤2 days reappears even if dismissed today | The daily cap is a courtesy; imminent loss of money outranks it. |
| AsyncStorage, not the database | A per-device UI dismissal, not an account preference. Already a project dependency. |

Stored record is `{ date, minDays }` under `expiring_banner_dismissal` — the
day count at dismissal time is what makes the escalation check possible.

Files: [`ExpiringCouponsBanner.tsx`](./src/components/dashboard/ExpiringCouponsBanner.tsx),
[`WalletHeroCard.tsx`](./src/components/dashboard/WalletHeroCard.tsx),
[`DashboardScreen.tsx`](./src/screens/dashboard/DashboardScreen.tsx).

---

## 2. Daily reminders by push and email

### The ask

Also send a push notification and an email once a day, controllable from
settings. Then: "I did not get an in-app notification today about the coupon
that is about to expire."

### What already existed

Most of it. `send-expiry-alerts` was already the single driver for email
(Brevo), push (Web Push + Expo) and in-app notifications, run hourly by pg_cron,
with per-channel preferences, quiet hours, and a `coupon_alerts` ledger that
stops repeat sends. The settings screen already exposed the three channel
toggles and the reminder windows.

### Root cause of the missing notification

Not a fault in the system. The VANS coupon expires 2026-09-07 — **13 days out**.
The reminder windows were 30/7/1/0, and 13 matches none of them. The cron job
was healthy: 140 runs, zero failures.

A second observation, deliberately left alone: runs before 09:00 local report
`due: 0` for every user. That is `DEFAULT_SEND_HOUR`, an intentional quiet-hours
floor, not a bug.

### Decisions

| Decision | Why |
| --- | --- |
| A daily mode alongside the fixed windows, not replacing them | A 30-day heads-up is still useful under a 14-day daily reach. The two union. |
| `daily_within integer` rather than a boolean | Same code either way, and the reach is tunable without another migration. `NULL` = off. |
| Reuse `coupon_alerts` for deduplication — no new table, no new logic | Each day gives the coupon a different `window_days`, so one send per day per coupon per channel falls out for free. |
| Off by default for everyone | Silently increasing 131 users' email frequency is not a decision to make on their behalf. Enabled only on the requesting account. |
| Reach fixed at 14 days in the UI | Same window as the banner and the dashboard tile. |

Files:
[`20260825120000_daily_expiry_reminders.sql`](./supabase/migrations/20260825120000_daily_expiry_reminders.sql),
[`send-expiry-alerts`](./supabase/functions/send-expiry-alerts/index.ts),
[`NotificationSettingsScreen.tsx`](./src/screens/settings/NotificationSettingsScreen.tsx),
[`notificationWindows.ts`](./src/lib/notificationWindows.ts).

### Verified

Ran the function against the real project. Result `due:1, email:1, inApp:1`,
ledger rows at `window_days: 13`, and the in-app row
`הקופונים הבאים עומדים לפוג בעוד 13 ימים: VANS (50.00 ₪)`.

The 09:00 floor meant the account was not due at test time, so the timezone was
moved to `Asia/Tokyo` for the run and **restored to `Asia/Jerusalem`
afterwards**.

Push did not send: the account has no `push_subscriptions` row. Notifications
have to be enabled on a device first — the settings screen has a "שלח התראת
בדיקה" button for that.

---

## 3. The unsubscribe link went to the home page

### The ask

The email footer link ("לא רוצה לקבל תזכורות תפוגה במייל? אפשר לבטל כאן") landed
on the home screen instead of a page for managing which emails arrive. If signed
out, it should go to login and then straight to the right page. Framed as legal
exposure. Research the correct practice and implement it end to end.

### Root cause — two faults, either one enough

1. **A stale `APP_BASE_URL`.** It pointed at `www.couponmasteril.com`, which now
   301s *every* path to `https://coupons.itaykarkason.com/?utm_source=old-site…`
   — dropping the path and the token with it. That is literally the home page
   the link landed on. Reset to `https://coupons.itaykarkason.com` and the
   sending functions redeployed.
2. **No `/unsubscribe` route in the app.** Even reaching the right domain,
   expo-router fell through to `+not-found`, whose only button goes to
   `/(tabs)`. The link, the signed token and the `manage-unsubscribe` function
   were all fine.

The first fault masked the second: fixing only the route would still have sent
every recipient to the old domain's redirect.

### What the research said

RFC 8058 one-click unsubscribe, required by Gmail and Yahoo for bulk senders
since February 2024:

- `List-Unsubscribe` with an **HTTPS** URL, plus `List-Unsubscribe-Post:
  List-Unsubscribe=One-Click`.
- The endpoint takes an HTTP **POST** and must honour it with no further user
  action.
- It must return **2xx** — a 301/302/403/500 fails the unsubscribe.
- Keep the **body link as a preference centre**, separate from one-click.

Sources: [mailmodo](https://www.mailmodo.com/guides/rfc-8058/),
[valimail](https://www.valimail.com/blog/one-click-unsubscribe/),
[mailgun](https://www.mailgun.com/blog/deliverability/what-is-rfc-8058/),
[suped](https://www.suped.com/learn/email-deliverability/what-are-the-requirements-for-one-click-unsubscribe-in-email-marketing).

### Decisions

| Decision | Why |
| --- | --- |
| A preference centre, not a "you are unsubscribed" page | The two kinds of mail are separated so stopping expiry reminders does not also stop product news, and either can be switched back on. |
| The page is **public**; the signed token is the authentication | A recipient must be able to opt out from their inbox without remembering a password. Requiring a login here is the legal exposure. |
| One-click POST stops **everything** | RFC 8058 gives no UI to ask in, so it takes the safest reading. |
| One-click points at the edge function, not the app page | The mail client POSTs unattended and needs a plain 2xx, not HTML. |
| `List-Unsubscribe` on bulk mail only | The newsletter and the expiry reminders get it; one-off transactional mail (test, issue report, balance summary) does not. |
| A remembered pending route in module scope, not a `next=` query param | Every entry — password, Google, Apple, legacy — passes the same guard, so one variable covers all of them without threading a parameter through each. |
| Footer wording changed to "ניהול ההתראות וביטול" | The link now does more than cancel. |
| Malformed token → 400, not 500 | A hand-edited link is a bad request, not a server fault. |
| `APP_BASE_URL` set to the apex domain in use, not the legacy one | A migration redirect that discards the path silently breaks every link in every email sent since the move. |
| `first_name` dropped from the response | Unused by the page, and the endpoint is public. |

API shape of `manage-unsubscribe`:

```
GET  ?token=...                      → { email, expiry_email, marketing_email }
POST {token, scope, opted_out}       → scope: 'expiry' | 'marketing' | 'all'
POST ?token=... (form body)          → RFC 8058 one-click, 200 text/plain
```

Files:
[`manage-unsubscribe`](./supabase/functions/manage-unsubscribe/index.ts),
[`_shared/unsubscribe.ts`](./supabase/functions/_shared/unsubscribe.ts),
[`_shared/emailTemplate.ts`](./supabase/functions/_shared/emailTemplate.ts),
[`send-emails`](./supabase/functions/send-emails/index.ts),
[`UnsubscribeScreen.tsx`](./src/screens/settings/UnsubscribeScreen.tsx),
[`app/unsubscribe.tsx`](./app/unsubscribe.tsx),
[`pendingRoute.ts`](./src/lib/pendingRoute.ts),
[`app/_layout.tsx`](./app/_layout.tsx).

### Verified

Against the deployed function, using a real token pulled from the actual email:

| Case | Result |
| --- | --- |
| `GET ?token=` | `{"email":"…","expiry_email":true,"marketing_email":true}` |
| `POST scope=expiry, opted_out=true` | `expiry_email:false`, marketing untouched |
| `POST scope=expiry, opted_out=false` | back on |
| One-click POST | `200`, both channels off |
| Malformed token | `400` |
| Tampered signature | `400` |

In the browser, at `/unsubscribe?token=…` **while signed out**: the page renders
with the account's real state, and flipping a switch persists — confirmed by
re-reading the endpoint after each click. Both switches were restored to on.

Signed out at `/notification-settings`: the guard redirects to login as
intended. **The hop back after login was not executed** — it needs the account
password, which was not entered.

Then end to end against a freshly sent production email. Its raw source carries:

```
List-Unsubscribe: <https://dugjsiyenazpsoiyduuz.supabase.co/functions/v1/manage-unsubscribe?token=…>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
DKIM-Signature: … h=from:subject:date:to:mime-version:content-type:
  content-transfer-encoding:list-unsubscribe:x-csa-complaints:
  list-unsubscribe-post:message-id:x-sib-id:feedback-id;
```

`dkim=pass`, and the `h=` list covers **both** List-Unsubscribe headers — the
condition Gmail checks before honouring one-click. Following the footer link
through Brevo's tracking redirect now resolves to
`https://coupons.itaykarkason.com/unsubscribe?token=…`, path and token intact.

### Incidental fix

The web dev server could not build: Metro handed `.env.brevo.local` to Babel,
which failed on the unquoted API key. A `blockList` entry in
[`metro.config.js`](./metro.config.js) excludes the non-standard dotenv
files. Pre-existing, unrelated to this work, but it blocked verification.

---

## 4. The link should open the app, not the browser

### The ask

If the native app is installed, the email link should open it. If the PWA is
installed, it should open that.

### What the research said

Both platforms have a first-party mechanism, and both need a two-way proof:
config in the app plus a file hosted on the domain. iOS calls it Universal
Links (`associatedDomains` + `/.well-known/apple-app-site-association`), Android
calls it App Links (`intentFilters` with `autoVerify` +
`/.well-known/assetlinks.json`). With the app absent, the link simply stays in
the browser.
([Expo linking overview](https://docs.expo.dev/linking/overview/),
[iOS universal links](https://docs.expo.dev/linking/ios-universal-links/))

An installed PWA needs no separate mechanism on Android: Chrome installs it as a
WebAPK that already captures in-scope https links. What it does need is a
`scope` that covers the path, and a `launch_handler` so the link lands in the
window that is already open.

### Decisions

| Decision | Why |
| --- | --- |
| Claim specific paths, not the whole host | `/unsubscribe`, `/coupons/*`, `/notifications`, `/notification-settings` are the routes the app actually has. Claiming everything sends marketing pages into the app too. |
| Android filter scoped with `pathPrefix` entries mirroring the AASA components | One list of app-owned paths, expressed twice because the platforms disagree on syntax. |
| `/.well-known/` excluded from the SPA rewrite in `vercel.json` | The AASA file has no extension, so the catch-all rewrite would have served it as `index.html` and both platforms would have rejected it. |
| Explicit `Content-Type: application/json` on both files | Required, and neither file's name implies it. |
| `scope: "/"`, `id: "/"` and `launch_handler: navigate-existing` in the manifest | Scope is what makes the WebAPK capture the link; navigate-existing avoids a second window. |

Files: [`apple-app-site-association`](./public/.well-known/apple-app-site-association),
[`app.json`](./app.json), [`vercel.json`](./vercel.json),
[`manifest.json`](./public/manifest.json).

### What this does not cover

- **Android App Links are configured but not yet verified.** `assetlinks.json`
  needs the release signing key's SHA-256 fingerprint, and there is no Android
  build on EAS to take it from. Until the file exists, Android ignores
  `autoVerify` and the link opens the browser — the same result as before, so
  nothing regresses.
- **An installed PWA on iOS cannot capture links at all.** Safari has no
  equivalent of WebAPK link capturing; the link opens in Safari. Installing the
  native app is the only way to get app hand-off on iOS.

## Open items

- **Push has no device registered** on the requesting account, so the push
  channel is untested end to end. Enable notifications on a device and use "שלח
  התראת בדיקה".
- **The post-login return hop is unverified** for the reason above.
- **`assetlinks.json` is missing.** After the first Android build:
  `eas credentials -p android` → copy the SHA-256 fingerprint → write
  `public/.well-known/assetlinks.json` with `package_name`
  `com.itaykarkason.couponmaster`. Verify with Google's Digital Asset Links
  tester before trusting it.
- **The iOS entitlement ships only in a new build.** `associatedDomains` is a
  native config change, so an already-installed build will not pick it up.
- **`daily_within` is off for every other user.** Consider whether to surface it
  as a suggestion rather than leaving it buried in settings.
