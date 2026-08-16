# Coupon Master — Expo Router / SDK 57 Migration

Migration of the Coupon Master React Native app from a hand-wired React Navigation
tree on Expo SDK 52 to **Expo Router on Expo SDK 57 / React Native 0.86 / React 19**.

- **Starting point:** `7bee58d` ("e2e") on `main`
- **Scope:** infrastructure only. Every screen, feature, string and style is preserved.
- **Merged to:** `main` (`06cbac9`), at the repository owner's explicit request.
- **Not done here:** no EAS build, no EAS Update, no store submission, no new EAS project.

---

## 1. Baseline before the migration

Recorded on a clean `npm ci` at `7bee58d`, before any change:

| Check | Result at baseline |
|---|---|
| `npm ci` | passes (with deprecation warnings) |
| `tsc --noEmit -p tsconfig.json` | **fails — 357 errors** (128 in native paths, 229 in leftover web paths) |
| `npm test` | **fails to start** — `vitest` loads the root `vite.config.ts`, which requires `@vitejs/plugin-react-swc`, not installed at the root |
| `expo-doctor` | not run at baseline (SDK 52 toolchain) |

The baseline native type-checking was not meaningful: `src/declarations.d.ts` declared
`react-native`, `expo-*`, all three `@react-navigation/*` packages and every
`lucide-react-native` icon as `any`. Those `declare module` blocks **override the real
typings shipped by the installed packages**, so the whole native surface was untyped
despite `strict: true`.

---

## 2. What changed

### 2.1 Dependencies (Expo SDK 57)

Pinned to the reference versions, then reconciled with `npx expo install --fix`
(which reports "Dependencies are up to date"). No `--force`, no `--legacy-peer-deps`.

| Package | Before | After |
|---|---|---|
| `expo` | `~52.0.0` | `~57.0.13` |
| `expo-router` | – | `~57.0.13` |
| `react` / `react-dom` | `18.3.1` | `19.2.3` |
| `react-native` | `0.76.9` | `0.86.2` |
| `typescript` | `~5.3.3` | `~6.0.3` |
| `@types/react` | `~18.3.12` | `~19.2.2` |
| `babel-preset-expo` | `~12.0.9` | `~57.0.7` |
| `react-native-safe-area-context` | `4.12.0` | `~5.7.0` |
| `react-native-screens` | `~4.4.0` | `~4.26.0` |
| `react-native-svg` | `15.8.0` | `15.15.4` |
| `react-native-web` | `~0.19.13` | `~0.21.0` |
| `@react-native-async-storage/async-storage` | `1.23.1` | `2.2.0` |
| all `expo-*` feature packages | SDK 52 line | SDK 57 line |

Added because Expo Router requires them: `expo-linking`, `expo-system-ui`,
`react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`.

Removed: `@react-navigation/native`, `@react-navigation/bottom-tabs`,
`@react-navigation/native-stack` — Expo Router 57 vendors its own navigation core, so
direct dependencies would only risk a duplicate/conflicting copy.

**`lucide-react-native` `^0.475.0` → `^1.31.0`.** This was a hard blocker, not a
preference: `0.475.0` declares `react@"^16.5.1 || ^17.0.0 || ^18.0.0"` and genuinely
cannot resolve against React 19. All **64** icon identifiers used in the app were
verified to still exist in `1.31.0` before accepting the bump.

**`patches/expo-dev-launcher+5.0.35.patch` retired** — see §6.

### 2.2 Entry point and routing

- `package.json` `main`: `index.ts` → `expo-router/entry`
- `app.json` `plugins`: `expo-router` added
- `App.tsx`, `index.ts` and all of `src/navigation/` deleted (after confirming no
  remaining importers)
- All 21 screens under `src/screens/` kept as-is and mounted from `app/`

### 2.3 Providers and the auth guard

`App.tsx`'s initialisation moved into `app/_layout.tsx`, in the same order:
`SafeAreaProvider` → `QueryClientProvider` → `AuthProvider` → `ThemeProvider` →
navigation `ThemeProvider` + `StatusBar` + `Stack`.

Two deliberate improvements over the old root component:

- **RTL** (`I18nManager.allowRTL(true)`) moved from a `useEffect` to module scope. It
  has to be set before the first layout pass; running it in an effect was already too
  late.
- **No early redirect and no flicker.** The guard redirects only once the stored
  session has resolved *and* the root navigator is mounted
  (`useRootNavigationState().key`). A full-screen overlay stays up until the rendered
  tree actually matches the session state, so neither side of the guard is ever
  briefly visible. The native splash screen is held until the same point.

Redirect loops are structurally impossible: the only two transitions are
"no session and outside `(auth)` → `/(auth)/login`" and
"session and inside `(auth)` → `/(tabs)`", and each lands in a state where its own
condition is false.

Login and logout do **not** navigate imperatively. They only change auth state; the
central guard performs the transition. That is why no `navigation.reset()` equivalent
was needed anywhere.

### 2.4 Navigation call sites

| Before | After |
|---|---|
| `navigation.navigate("Screen")` | `router.push("/route")` |
| `navigation.navigate("CouponsTab")` | `router.navigate("/coupons")` (tab switch, not a stack push) |
| `navigation.goBack()` | `router.back()` |
| `route.params` | `useLocalSearchParams()` |
| `NativeStackScreenProps` / `CompositeScreenProps` props | no props; hooks inside the component |

**`EditCoupon` no longer receives a `Coupon` object.** It was previously passed the
entire decrypted coupon through navigation params, which cannot survive a URL. It now
takes `?couponId=` and loads the coupon by id.

To keep this clean, `AddEditCouponScreen` was split into a small route component that
resolves the id and fetches the coupon, and the form itself, which is mounted only once
the data is available. That preserves every `useState` initialiser as a synchronous
expression instead of syncing props into state through effects.

### 2.5 TypeScript

- `src/declarations.d.ts` reduced from ~180 lines of `any` stubs to a single real
  declaration for `react-native-qrcode-svg` (the only untyped package left). Everything
  else now resolves to the genuine package typings.
- `tsconfig.native.json` added as the native project config; `tsconfig.json` extends it
  so editors and the Expo CLI agree. The native check is seeded from `app/**` and follows
  imports, so it covers exactly the React Native graph and cannot drift into the leftover
  web code at the repo root (`src/pages/`, the shadcn `src/components/ui/*` web variants,
  `vite.config.ts`, `index.html`, `tests/`), which is a duplicate of the self-contained
  app in `web/`.
- `npm run typecheck` added.
- `strict: true` retained. No `any` blanket, no `@ts-ignore`, no relaxed flags.

### 2.6 Expo / EAS config

`app.json`:
- top-level `splash` removed (invalid in the SDK 57 schema) and moved into the
  `expo-splash-screen` plugin, with the same image, `resizeMode` and background colour
- Android permissions de-duplicated: the list contained `CAMERA`, `NOTIFICATIONS`,
  `android.permission.CAMERA`, `android.permission.RECORD_AUDIO` **twice over**. Now
  `android.permission.CAMERA`, `android.permission.RECORD_AUDIO`,
  `android.permission.POST_NOTIFICATIONS`
- `runtimeVersion` unified to `{ "policy": "appVersion" }` at the top level. iOS was
  previously the literal `"1.0.0"` and Android already used `appVersion`; with
  `version: "1.0.0"` both resolve to the identical `"1.0.0"`, so **no existing OTA
  update channel is invalidated**
- `web.bundler: "metro"` / `web.output: "single"` added so the same codebase exports
  for web

Unchanged, as required: `name`, `slug`, `owner`, `bundleIdentifier`, Android `package`,
EAS `projectId`, `updates.url`, `scheme`, icons, camera permission strings.

`eas.json`: all four profiles (`development`, `development-simulator`, `preview`,
`production`) kept as-is; only `cli.appVersionSource: "local"` added, which EAS now
expects.

---

## 3. The new route structure

```
app/
  _layout.tsx              providers, navigation theme, RTL, splash, auth guard
  +not-found.tsx
  (auth)/
    _layout.tsx
    login.tsx              /login
    register.tsx           /register
    forgot-password.tsx    /forgot-password
  (tabs)/
    _layout.tsx            the 5 tabs
    index.tsx              /            → Dashboard  (ארנק)
    coupons.tsx            /coupons     → Coupons    (קופונים)
    scanner.tsx            /scanner     → Scanner    (סריקה)
    statistics.tsx         /statistics  → Reports    (דוחות)
    settings.tsx           /settings    → Settings   (הגדרות)
  coupons/
    [id].tsx               /coupons/123
    add.tsx                /coupons/add
    edit.tsx               /coupons/edit?couponId=123
    bulk-import.tsx        /coupons/bulk-import
  admin/index.tsx          /admin
  notifications.tsx  profile.tsx  sharing.tsx
  about.tsx  faq.tsx  privacy.tsx  issues.tsx
```

### Why this shape

- **`(auth)` and `(tabs)` are groups**, so they organise the code without adding URL
  segments. The guard can then test group membership with `useSegments()[0]` — one
  cheap, unambiguous check — instead of enumerating screens.
- **`(tabs)/index.tsx` owns `/`.** There is deliberately no `app/index.tsx`: it would
  collide with the tabs index for the same URL. The dashboard is the app's home, so it
  takes the root path directly.
- **The tab bar is the layout, not a screen.** Modal-ish and detail screens
  (`/coupons/add`, `/profile`, `/admin`, …) live at the root level, so they push over
  the tab bar exactly as they did in the old root stack.
- **`/coupons` (tab) and `/coupons/add` (root stack) coexist** because `app/coupons/`
  has no `index.tsx`. Static segments (`add`, `edit`, `bulk-import`) take precedence
  over `[id]`, so `/coupons/add` and `/coupons/123` both resolve correctly.
- **Every screen is addressable**, which is what makes deep links work without a
  separate linking configuration — the file tree *is* the linking config.

All 18 literal route strings and 3 dynamic `/coupons/${id}` templates in the codebase
were verified against the generated route tree; all resolve.

---

## 4. Verification

| Check | Result |
|---|---|
| `npm install` | pass, no peer-dependency overrides |
| `npx expo install --fix` | pass — "Dependencies are up to date" |
| `npx expo-doctor` | 20/21 (see §6 for the remaining one) |
| `npm run typecheck` (native, strict) | **pass — 0 errors** |
| `npm test` | **pass — 2 files, 7 tests** |
| `npx expo export --platform ios` | pass — 3442 modules, 6.2 MB Hermes bundle |
| `npx expo export --platform android` | pass — 6.5 MB Hermes bundle |
| `npx expo export --platform web` | pass — `index.html` + 3.8 MB bundle |
| no stale `@react-navigation` / `@/navigation` imports | pass |
| `git diff --check` | pass |
| `pod install` | **not run** — CocoaPods is unavailable on this Linux runner (see §6) |

Native type errors: **128 → 0**, with **zero new regressions** introduced by the
migration (verified by diffing normalised error sets against the baseline).

### Smoke-test status

Static verification only — no simulator or device is available in this environment.
Route resolution, the guard's state machine, provider order and bundling are verified
as above; the following still need a manual pass on a dev client build: session restore
on launch, redirect to login without a session, login → tabs, all five tab switches,
coupon list, open coupon by id, add coupon, edit coupon by id, scan → prefilled add
form, notifications, settings, profile, sharing, admin panel for an admin user, logout →
login, and a deep link into an inner screen.

---

## 5. Problems that already existed before the migration

These were found *because* the fake `any` declarations were removed. None were caused
by this migration.

1. **The whole native surface was untyped.** `src/declarations.d.ts` shadowed the real
   typings of `react-native`, every `expo-*` package, all `@react-navigation/*`
   packages and 60+ lucide icons with `any`.

2. **`src/integrations/supabase/types.ts` did not satisfy the Supabase client's
   constraints and was stale.** Every table was missing the required `Relationships`
   key, so the schema failed `GenericTable` and *every* query resolved to `never` —
   this alone accounted for ~55 of the 58 remaining errors. The file was also out of
   date with the live database in both directions: missing `region`,
   `coupons_sold_count`, `newsletter_image`, `allow_widget_access`, `push_token` and
   `auth_user_id` on `users` (`auth_user_id` is added by the repo's own migration
   `0010_auth_foundation.sql`), while declaring five `users` columns that do not exist
   in production. It has been regenerated from the live schema of project
   `dugjsiyenazpsoiyduuz`.

3. **`useCreateShare` could never have worked.** It inserted a `permission` column into
   `coupon_shares` — that column does not exist — and omitted `share_token` and
   `share_expires_at`, which are `NOT NULL` with no default. The screen calls it, so
   "share a coupon" was a broken user-facing feature. Repaired: the phantom `permission`
   field (never passed by the caller) is gone, and the insert now supplies a
   `Crypto.randomUUID()` token and an expiry. **The 30-day expiry is an assumption —
   please confirm the intended sharing policy.** `expo-crypto` was added for the token.

4. **`USER_COLUMNS` was built with `[...].join(',')`.** That produces type `string`, and
   supabase-js needs a literal to resolve a `.select()` row shape, so `useProfile`
   silently resolved to an error type. Now a single literal; runtime output is identical.

5. **`src/integrations/supabase/index.ts` exported `CouponRequest`** for a
   `coupon_requests` table that does not exist. It had no users; removed.

6. **`npm test` could not run at all** (root `vite.config.ts` needs a plugin that is not
   installed at the root). A dedicated `vitest.config.mts` scoped to `src/lib/**/*.test.ts`
   fixes this without touching the leftover web build files.

7. **Duplicated Android permissions** in `app.json` (each of four entries listed twice).

8. **`StyleSheet.absoluteFillObject`** was used in two places. It is removed in RN 0.86 —
   *at runtime as well as in the types*. Because the object was spread, it would have
   silently degraded to a no-op and broken the scanner overlay's positioning rather than
   throwing. Replaced with `StyleSheet.absoluteFill`, which is now a plain object.

9. **`expo-file-system`'s `documentDirectory` / `writeAsStringAsync` / `EncodingType`**
   were removed from the main entry point in SDK 54+. The statistics CSV export now uses
   the `File` / `Paths` API. The UTF-8 BOM behaviour that makes Hebrew open correctly in
   Excel is preserved.

---

## 6. Risks and remaining work

### The iOS project needs a controlled regeneration — this is the main open item

`ios/` is committed and was generated for SDK 52 / RN 0.76:

- `ios/Podfile.lock` still pins `Expo (52.0.49)` and `React-Core (0.76.9)`.
- `AppDelegate.mm` is the pre-SDK-57 Objective-C template.
- `ios/Podfile.properties.json` had `newArchEnabled: "false"`. **The legacy architecture
  no longer exists in React Native 0.82+**, so this was not a supported setting any
  more; it has been set to `"true"`. This is the one native change made here.

Per the brief, `expo prebuild --clean` was **not** run. There is a genuine native
customisation to preserve first: the `post_install` block in `ios/Podfile` rewrites two
generated build phases (`[CP-User] Generate Specs` and
`[CP-User] Generate app.config for prebuilt Constants.manifest`) so the project builds
from a path containing spaces. A blind prebuild would discard it.

Recommended sequence, on a machine with Xcode:

1. `npx expo prebuild --platform ios` (without `--clean`) and read the diff.
2. Re-apply the `post_install` shell-script rewrites if prebuild overwrites the Podfile.
3. `pod install`.
4. Build a development client and run the smoke-test list in §4.

`expo-doctor`'s single remaining failure is the expected consequence of committing
`ios/` while also keeping native fields in `app.json`. It is pre-existing and is not
introduced by this work.

### Android

There is no `android/` directory, so Android is fully CNG-managed and picks up the new
config automatically. **16 KB page alignment has not been verified** — it needs a real
release artifact. Before the next Play submission:

```bash
zipalign -c -P 16 -v 4 app-release.apk
```

RN 0.79+ ships aligned first-party binaries, so the risk sits with third-party native
libraries.

### The retired dev-launcher patch

`patches/expo-dev-launcher+5.0.35.patch` guarded two `valueForKeyPath:` reads in
`EXDevLauncherController.m` against non-string values. In `expo-dev-launcher@57.0.12`
that whole code path has been rewritten upstream and now carries its own fallbacks, so
the patch cannot apply and `patch-package` (with its `postinstall` hook) was removed
along with it. **Worth re-checking once an iOS dev client is built**: if the original
crash reappears, re-cut the patch against 57.x. The git history retains the original.

### Security notes (documented, deliberately not changed)

- `extra.supabaseAnonKey` in `app.json` is a publishable anon key; exposure on the
  client is expected, but RLS is what actually protects the data. Moving it to a
  documented `EXPO_PUBLIC_*` environment variable is the tidier end state —
  `.env.example` already exists.
- `extra.encryptionKey` is bundled with the app and is therefore **not a real secret**;
  anyone with the binary can extract it. It was **not** changed, removed or rotated,
  because rotating it would make every already-encrypted coupon code undecryptable.
  Fixing this properly means a separate, planned migration: derive or fetch the key
  per-user, re-encrypt existing rows, then retire the bundled key. That work should not
  ride along with an infrastructure upgrade.

### Other follow-ups

- Confirm the 30-day share expiry (§5.3).
- The leftover web copy at the repo root (`src/pages/`, web `src/components/ui/*`,
  `vite.config.ts`, `index.html`, `tests/`) duplicates the self-contained app in `web/`
  and is now excluded from the native type check. Deleting the duplicate would be a
  worthwhile, separate cleanup; it was left alone here to avoid touching unrelated code.
- Expo Router's typed routes (`experiments.typedRoutes`) would make route strings
  compiler-checked. Not enabled here to avoid depending on generated types in CI, but
  it is a natural next step now that the route tree is stable.

---

## 7. Key files changed

**Added**
```
app/_layout.tsx                    providers + auth guard
app/(auth)/_layout.tsx  + 3 routes
app/(tabs)/_layout.tsx  + 5 tab routes
app/coupons/{[id],add,edit,bulk-import}.tsx
app/admin/index.tsx, app/+not-found.tsx
app/{notifications,profile,sharing,about,faq,privacy,issues}.tsx
tsconfig.native.json, vitest.config.mts
EXPO_ROUTER_MIGRATION.md
```

**Deleted**
```
App.tsx, index.ts
src/navigation/{RootNavigator,AuthNavigator,TabNavigator,types}.tsx
patches/expo-dev-launcher+5.0.35.patch
```

**Modified (most significant first)**
```
package.json                       SDK 57 deps, expo-router/entry, typecheck script
src/integrations/supabase/types.ts regenerated from the live schema
src/declarations.d.ts              ~180 lines of any stubs → one real declaration
app.json                           router plugin, splash, permissions, runtimeVersion, web
src/screens/coupons/AddEditCouponScreen.tsx   id-based edit, split into resolver + form
src/screens/**                     17 screens converted to router hooks
src/hooks/useSharing.ts            repaired broken share insert
src/hooks/useAdminManagement.ts    typed user update
src/lib/userColumns.ts             literal column list
src/integrations/supabase/index.ts dropped non-existent table alias
src/screens/statistics/StatisticsScreen.tsx   new expo-file-system API
tsconfig.json, eas.json, ios/Podfile.properties.json
```

---

## 8. Web preview deployment

The web target is deployed from `main` by Vercel's git integration:

**https://coupon-master-itays-projects-8e2b877e.vercel.app**

`vercel.json` builds `npx expo export --platform web --output-dir dist` and rewrites
unknown paths to `index.html`, so deep links and refreshes resolve client-side.
Verified: `/`, `/login`, `/coupons`, `/settings`, `/statistics` and the dynamic
`/coupons/123` all return 200, and the 3.8 MB bundle serves.

Two caveats:

- This is the **web** build (`react-native-web`), not the native app. For a phone,
  run `npm run start:go` locally and scan the QR in Expo Go — the only dependency not
  bundled in Expo Go is `expo-dev-client`, which `--go` bypasses.
- The preview is public and talks to the **production** Supabase project. RLS and auth
  are what protect it, and the anon key was already shipped in the mobile app, so this
  is not new exposure — but enable Vercel Authentication on the project if the URL
  should be gated.

---

## 9. Git status

The migration was initially left uncommitted as instructed. The repository owner then
explicitly asked for it to be committed and pushed to `main` rather than to the
`claude/coupon-master-expo-router-yzrl6s` branch, which is what happened:

- `06cbac9` — the migration itself (66 files)
- `2a157f8` — point `vercel.json` at the Expo Router web export
- `4022d93` — trigger the first Vercel build

`origin/main` was still at `7bee58d`, so this was a clean fast-forward; nothing was
overwritten. The `claude/coupon-master-expo-router-yzrl6s` branch still exists locally
and on the remote, at the original `7bee58d`.
