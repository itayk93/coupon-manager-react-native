# Home-Screen Widgets — iOS + Android

Session log and implementation reference. Date: 2026-08-17.

## Goal

Port the home-screen widget from the native Swift app at
`~/Python Projects/CouponManagerApp` into this Expo/React Native project,
matching it 1:1 in design and functionality, on **both** iOS and Android.

## Source of truth

The reference implementation is `CouponManagerApp/CouponWidgetExtension/`:

| File | Role |
|---|---|
| `CouponManagerWidget.swift` (1076 lines) | All three widget faces + Fernet decryption inline |
| `WidgetAPIClient.swift` | Reads coupons from the App Group container |
| `SharedModels.swift` | `WidgetCoupon` / `WidgetCompany` decoding |
| `WidgetSettings.swift` | Refresh interval (10 min default) |

Layout, sizing and behaviour were taken from it verbatim. **Colours and type
were not** — see the next section.

- Coupon code wrapped onto up to 4 lines (see note below)
- Card `cornerRadius 12`, code chip `cornerRadius 15`
- Small face flips to an expiry-alert layout for 3 seconds each minute
- Medium shows 2 coupons with a "בחר קופון נוסף" placeholder when only one is
  selected; Large shows a header plus up to 4

## Visual language: the new design system, not the old one

The first pass copied the original's palette (`#2C3F50` chrome, system blue,
SF Rounded). That was then re-skinned onto this app's redesign — every value
now comes from `src/lib/theme.ts`, and each is annotated with its token name at
the point of definition.

| Element | Original | Now | Token |
|---|---|---|---|
| Background | `#2C3F50` gradient | `#15202e` gradient | `palette.headerBg` |
| Coupon code | system `.blue` | `#5b9bd8` | `palette.primaryLight` |
| Secondary text | white 70% | `#98a2b3` | `palette.lightTextSubtle` |
| Card | `primary@5%` / `@8%` | white 6% / 10% | — |
| Code chip | `blue@10%` / `@30%` | `primary@18%` / `primaryLight@35%` | `palette.primary` |
| Expiry alert | ad-hoc orange-red | `#f59e0b → #b45309` | `palette.warning` |
| Logo fallback | `%` + `✂` glyphs | brand gradient + `%` | `primary → primaryDark` |
| Type | SF Rounded | **Heebo**, 4 weights | `fonts.*` |

The widget wears the app's *chrome* colour rather than its light body: a
home-screen tile has to stay legible over an arbitrary wallpaper. Hero figures
(total balance, stat counters, alert amount) use Heebo ExtraBold, matching
`fonts.display`.

**Font bundling.** Heebo ships inside both widgets so the type matches the app
exactly:

- iOS — `targets/widget/fonts/*.ttf`, registered via `UIAppFonts` in
  `targets/widget/Info.plist`. The target is a `PBXFileSystemSynchronizedRootGroup`,
  so Xcode picks the files up automatically; `Info.plist` is on the membership
  exception list and is read, never regenerated, by `@bacons/apple-targets`.
  Referenced by PostScript name (`Heebo-Regular`, `Heebo-Medium`, `Heebo-Bold`,
  `Heebo-ExtraBold`), not filename.
- Android — `res/font/heebo_{regular,medium,bold,extrabold}.ttf`, referenced
  from the layouts as `@font/…`.

## Architecture decision: the app precomputes, the widget renders

The original widget did its own work — read raw coupon rows from the shared
container, filtered by status, summed balances, and decrypted Fernet
ciphertext with CryptoKit + CommonCrypto.

Reproducing that would have meant writing the same business rules **three
times**: TypeScript, Swift, and Kotlin — including a second and third Fernet
implementation.

Instead the app builds a finished payload and writes it to shared storage.
Both widgets became pure presentation: no network, no crypto, no coupon rules.

```
useCoupons()  ──►  buildWidgetPayload()  ──►  setWidgetData(json)
                                                     │
                        ┌────────────────────────────┴───────────────┐
                        ▼                                            ▼
          App Group UserDefaults                        SharedPreferences
          group.com.itaykarkason.couponmaster           CouponWidgetPrefs
                        │                                            │
                        ▼                                            ▼
             WidgetKit timeline                         AppWidgetProvider
```

Payload shape (`modules/coupon-widget/index.ts` is the canonical definition;
`targets/widget/SharedStore.swift` and the Kotlin `SharedStore` mirror it):

```jsonc
{
  "updatedAt": "2026-08-17T14:00:00.000Z",
  "activeCouponsCount": 12,
  "oneTimeCouponsCount": 3,
  "totalRemainingValue": 1450,
  "coupons": [
    {
      "id": 42,
      "company": "וולט",
      "code": "1234567890",   // already decrypted
      "remainingValue": 100,
      "expiration": "2026-09-01",
      "logoUrl": "https://…"  // already resolved
    }
  ]
}
```

Consequences worth knowing:

- Decrypted coupon codes sit in the App Group container / SharedPreferences.
  That is inherent to showing a code on the home screen — the original did the
  same, just decrypting later. `clearWidgetData()` runs on sign-out so codes do
  not outlive the session.
- The widget is only as fresh as the last app foreground. Acceptable: the
  original refreshed on a 10-minute timeline from a container the app wrote to
  anyway.

## What was built

### 1. `modules/coupon-widget/` — Expo local module

The JS↔native bridge. Autolinked; no config plugin needed.

- `index.ts` — typed `setWidgetData` / `getWidgetData` / `clearWidgetData` /
  `reloadWidgets`. Uses `requireOptionalNativeModule` so web and Expo Go
  keep working (`isWidgetSupported` is false there).
- `ios/CouponWidgetModule.swift` — writes to the App Group suite, calls
  `WidgetCenter.shared.reloadAllTimelines()`. Shipped as the pod
  `CouponWidgetBridge`; see the module-name collision note below for why the
  pod name must not match the widget target name.
- `android/.../CouponWidgetModule.kt` — writes SharedPreferences, broadcasts
  `ACTION_APPWIDGET_UPDATE`.
- `android/.../SharedStore.kt` — JSON parsing, `WidgetPayload` / `WidgetCoupon`.
- `android/.../CouponWidgetProvider.kt` — the Android widget itself.

### 2. `targets/widget/` — iOS WidgetKit extension

Wired through `@bacons/apple-targets` (added as a devDependency and to
`app.json` plugins) so the Xcode target is regenerated by `expo prebuild`
rather than hand-edited into the pbxproj and lost on the next clean.

- `expo-target.config.js` — target type, deployment target 16.0, App Group
  entitlement.
- `SharedStore.swift` — payload models + App Group read.
- `CouponWidget.swift` — the three faces, ported from the original:
  - **systemSmall** — logo, divider, one-time / active counters, total balance.
    Keeps the original's alert face: for the first 3 seconds of each minute it
    flips to the orange gradient if a coupon expires within 7 days.
  - **systemMedium** — up to 2 coupon cards, plus the "בחר קופון נוסף"
    placeholder when only one is selected.
  - **systemLarge** — header (logo, active count, balance), divider, all cards.
- `Assets.xcassets/CouponLogo.imageset` — app icon for the widget header.
- Layout direction forced to `.rightToLeft` at the entry view, so the Hebrew
  reads correctly regardless of device locale.

### 3. Android — one resizable widget, RemoteViews

`SizeMode`-style breakpoints inside `CouponWidgetProvider.buildViews()`:

| Size | Face |
|---|---|
| width < 200dp and height < 250dp | stats (iOS small) |
| height < 250dp | 2 coupon cards (iOS medium) |
| otherwise | header + up to 4 cards (iOS large) |

`onAppWidgetOptionsChanged` re-renders on resize. Logos load off the main
thread and trigger a second `updateAppWidget` once decoded and circle-cropped.

**Why RemoteViews and not Glance/Compose:** Glance needs the
`org.jetbrains.kotlin.plugin.compose` Gradle plugin on the root classpath.
That classpath lives in `android/build.gradle`, which `expo prebuild`
generates — so using Glance would have required a config plugin that parses
and rewrites generated Gradle files on every prebuild. RemoteViews reaches the
same design with zero build-system surgery. The Glance version was written
first and replaced after the build failed with
`Plugin with id 'org.jetbrains.kotlin.plugin.compose' not found`.

### 4. JS sync layer

- `src/lib/couponTotals.ts` — `isSpendableCoupon` / `totalRemainingValue`, the
  single definition of what counts. See "Keeping the widget and the app in
  agreement" below.
- `src/lib/widgetSync.ts` — `buildWidgetPayload()`. Widget cards =
  `show_in_widget` and remaining > 0, sorted by `widget_display_order`, capped
  at 4.
- `src/hooks/useWidgetSync.ts` — mounted once in `app/_layout.tsx`. Pushes on
  every coupon change; clears on sign-out.

### 5. Widget management screen

`src/screens/settings/WidgetSettingsScreen.tsx`, routed at
`app/widget-settings.tsx`, linked from Settings.

Mirrors the original `WidgetCouponsManagementView` + `WidgetCouponsOrderingView`:
"בחר עד 4 קופונים", an `n/4` counter, selected list with up/down reordering,
and an available list. `show_in_widget` and `widget_display_order` already
existed in the `coupon` table, so no migration was needed.

### 6. Deep links

Changed from the original's `couponmanager://coupon/{id}` to
`couponmaster:///coupons/{id}` — this app's scheme, and a path expo-router
already resolves to `app/coupons/[id].tsx` with no extra handling code.

## Configuration changes

`app.json`:

```jsonc
"ios": {
  "appleTeamId": "TM252YSY6T",
  "entitlements": {
    "com.apple.security.application-groups": ["group.com.itaykarkason.couponmaster"]
  }
},
"plugins": [ …, "@bacons/apple-targets" ]
```

`android/` was generated by `expo prebuild` — it had never been committed,
though `.gitignore` already contained `android/build/` and friends, so
tracking it matches the repo's intent.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `xcodebuild -scheme CouponWidget` (extension) | BUILD SUCCEEDED |
| `xcodebuild -project Pods -target CouponWidget` (bridge pod) | BUILD SUCCEEDED |
| `./gradlew :coupon-widget:assembleDebug` | BUILD SUCCESSFUL |
| `./gradlew :app:assembleDebug` (full Android app) | BUILD SUCCESSFUL, 10m51s |
| `CouponWidgetProvider` in merged `AndroidManifest.xml` | present, with `APPWIDGET_UPDATE` |
| `xcodebuild -scheme CouponMaster` (full iOS app) | BUILD SUCCEEDED |
| `xcodebuild -configuration Release -destination <device>` | BUILD SUCCEEDED, installed |
| `CouponWidget.appex` in `CouponMaster.app/PlugIns/` | present, `widgetkit-extension` |
| App + appex share `group.com.itaykarkason.couponmaster` | confirmed via `codesign -d --entitlements` |
| 4 Heebo `.ttf` files inside the appex | confirmed |
| All three faces rendered in the widget gallery | confirmed by screenshot |

The full iOS app build first failed on a Swift module name collision — see the
next section — and was rebuilt after the fix.

## Bug found and fixed: Swift module name collision

The full iOS app build failed with:

```
Pods-CouponMaster/ExpoModulesProvider.swift:48:16: error: cannot find 'CouponWidgetModule' in scope
```

The bridge pod was originally named `CouponWidget` — the same name as the
widget **appex** target. The autolinked `internal import CouponWidget` in
`ExpoModulesProvider.swift` resolved to the app extension's Swift module rather
than the pod, so `CouponWidgetModule` was not in scope.

Fixed by renaming the podspec to `CouponWidgetBridge`
(`modules/coupon-widget/ios/CouponWidgetBridge.podspec`). The JS-facing module
name stays `CouponWidget` — `Name("CouponWidget")` in the module definition is
independent of the pod name, so `requireOptionalNativeModule("CouponWidget")`
is unchanged. Android was never affected.

Worth remembering: **the iOS pod name and the widget target name must differ.**
Building the widget target alone passed all along; only the app target, which
imports both, exposed it.

## Issue investigated and closed: `expo-sharing`

The first full iOS build failed:

```
node_modules/expo-sharing/ios/SharingModule.swift:17:33: error: type 'FileSystemUtilities' has no member 'isReadableFile'
```

Not a version mismatch. `isReadableFile` exists in
`expo-modules-core/ios/FileSystemUtilities/FileSystemUtilities.swift:55`, and
it is present in **all nine** `.swiftinterface` slices of the prebuilt
`ExpoModulesCore.xcframework`. The failure was a stale module cache in
DerivedData, left over from building the widget target alone. Fixed by
`rm -rf ~/Library/Developer/Xcode/DerivedData/CouponMaster-*`.

A related contributing factor: `npm install @bacons/apple-targets` reverted
the repo's `patch-package` patches; `npx patch-package` was re-run to restore
all four.

## Unrelated finding worth acting on

`ExpoModulesCore` and `ExpoFileSystem` link as **prebuilt xcframeworks**
(`try_link_with_prebuilt_xcframework` in their podspecs), not from source.
Therefore `patches/expo-modules-core+57.0.11.patch` and
`patches/expo-modules-jsi+57.0.4.patch` have **no effect on iOS builds** —
patch-package reports them applied, but the compiled binary ignores them. If
either patch fixes a real iOS crash, it is currently inert. Out of scope for
this work; not changed.

## Face ID

Requested during the session. Already fully implemented before this work —
nothing was added:

| Piece | Location |
|---|---|
| Hardware detection, enable/disable, prompt | `src/hooks/useBiometricAuth.ts` |
| Full-screen lock, re-locks on background | `src/components/layout/BiometricGate.tsx` |
| "נעילה עם Face ID" toggle | `src/screens/settings/SettingsScreen.tsx:166` |
| `NSFaceIDUsageDescription`, `expo-local-authentication` | `app.json` |

Auto-detects Face ID / fingerprint / iris and falls back to the device
passcode. The toggle only renders when hardware exists **and** a face/finger is
enrolled — on the simulator, enable `Features → Face ID → Enrolled` first.

Scope note: this gates an already-signed-in session. A signed-out user still
types email and password once; no password is stored anywhere. Replacing the
login form with Face ID would require persisting credentials on-device — a
different security tradeoff, not made here.

## Running it

```bash
npx expo prebuild --clean
npm run ios     # or: npm run android
```

Then long-press the home screen → add "ניהול קופונים". Pick coupons in
Settings → ווידג'ט מסך הבית.

Device builds need the App Group `group.com.itaykarkason.couponmaster` and the
extension bundle id `com.itaykarkason.couponmaster.widget` registered in the
Apple Developer account; the simulator does not.

## Status

- Committed as `c05eb82`, merged to `main` (fast-forward `ae16995..c05eb82`),
  pushed. Working branch `feat/home-screen-widgets` deleted local + remote.
- Verified end-to-end on the iOS simulator: the widget appears in the gallery
  as "ניהול קופונים" and all three faces render with the new palette, Heebo,
  and correct RTL from a seeded App Group payload.
- A Release build was installed on a physical iPhone (Apple Development
  signing, so it expires after 7 days).

### Keeping the widget and the app in agreement

The widget first shipped showing **33 coupons / ₪3,691** while the dashboard
showed **35 / ₪4315.21** for the same wallet. Two independent causes:

1. **Different predicate.** The dashboard counts
   `!is_for_sale && status !== "נוצל"`; the widget counted `status === "פעיל"`,
   missing coupons whose status is neither.
2. **One-time coupons.** The widget excluded them from the balance, inherited
   from the original's `filter { !$0.isOneTime }`. That made sense there —
   a one-time coupon has no partial remainder — but this app's dashboard counts
   their full value as spendable, and two different numbers for one wallet
   means the user trusts neither.

The root cause was duplication: `!is_for_sale && status !== "נוצל"` was written
out three separate times (`DashboardScreen`, `WalletHeroCard`, and the widget).
`src/lib/couponTotals.ts` now holds it once and all three import it.

The widget also truncated (`Int(4315.9)` → `4315`); it rounds now. It still
shows whole shekels while the app shows agorot — a deliberate choice for a
small tile, and the only remaining intentional difference.

## Deviations from the original, on purpose

**Code wrapping.** The original broke every 10 characters, so a 12-character
code rendered as `9182736455` + `01` and read as truncated. `formatCouponCode`
now splits into up to 4 *balanced* lines — the same code renders `918273` /
`645501`. Codes of 10 or fewer stay on one line, and 20 characters still gives
10 + 10, so only the ragged cases change. Implemented identically in Swift and
Kotlin; each references the other.

**`users.allow_widget_access`.** This per-user flag predates the app.
`useWidgetSync` now clears the shared payload when it is set, so a blocked
account shows nothing on the home screen. Only an explicit `false` blocks —
the column is nullable and most rows are null, so treating null as "blocked"
would silently disable the widget for nearly everyone.
