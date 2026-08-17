# Building CouponMaster on a physical iPhone

Everything here was found while getting a Debug build onto a real device with Expo SDK 57 /
React Native 0.86 / Xcode 26.3. The environment quirks in the first section are the reason most
of the failures below happen at all.

## Environment requirements

| Requirement | Why |
| --- | --- |
| `export LANG=en_US.UTF-8` in your shell profile | CocoaPods 1.17 crashes with `Unicode Normalization not appropriate for ASCII-8BIT` on any `pod install` without a UTF-8 locale. `expo prebuild` runs `pod install` internally, so it fails there too. |
| Project path contains a space (`.../Python Projects/...`) | Several Xcode script phases don't quote paths and break on it. See "Space-in-path bugs" below. Moving the repo to a space-free path removes this whole class of problems permanently. |
| Device must trust the developer certificate | After the first install: Settings → General → VPN & Device Management → the `Apple Development: <your email>` profile → Trust. Without it the install succeeds but the launch fails with `FBSOpenApplicationErrorDomain error 3` / "invalid code signature, inadequate entitlements or its profile has not been explicitly trusted". |

## Commands

```bash
npm run ios:device   # build + install + launch on a connected iPhone
```

```bash
npm run ios          # simulator
```

```bash
npm start            # Metro only, once the app is already installed
```

If you ever need to run CocoaPods by hand:

```bash
cd ios && LANG=en_US.UTF-8 pod install
```

## Fixes applied

### 1. Native project regenerated (`AppDelegate`)

`ios/CouponMaster/AppDelegate.h` / `.mm` were from a pre-SDK-54 template and subclassed
`EXAppDelegateWrapper`, which no longer exists in Expo 57 (it's `ExpoAppDelegate`, in Swift). The old
header also did `#import <RCTAppDelegate.h>`, which pulled the React-RCTAppDelegate headers from
source while `<Expo/Expo.h>` pulled the same classes from the prebuilt React xcframework — dozens of
`duplicate interface definition` errors.

Fixed by regenerating the native project from `app.json`:

```bash
npx expo prebuild -p ios --clean
```

This replaced the ObjC AppDelegate with `ios/CouponMaster/AppDelegate.swift` and dropped
`main.m` / `noop-file.swift` / `PrivacyInfo.xcprivacy`. `Info.plist` was regenerated from `app.json`
and gained the Face ID, local-network, and Bonjour keys the config plugins declare.

> `PrivacyInfo.xcprivacy` is no longer generated. It isn't needed for a device build, but if you
> submit to the App Store, check whether you need to add it back.

### 2. Stale CocoaPods umbrella header

`React-RCTAppDelegate-umbrella.h` still listed `RCTAppDelegate+Protected.h`, a file that doesn't
exist in RN 0.86 — CocoaPods had not regenerated it because the pod's checksum hadn't changed. A
plain `pod install` does **not** fix this. Delete the sandbox first:

```bash
rm -rf ios/Pods && cd ios && LANG=en_US.UTF-8 pod install
```

### 3. Space-in-path bugs in script phases

Three build phases pass an unquoted path to a shell and break on `Python Projects`, all with the
same symptom: `bash: /Users/itaykarkason/Python: is a directory`.

- `ios/CouponMaster.xcodeproj/project.pbxproj` — the *Bundle React Native code and images* phase ran
  the RN xcode script via backticks. Now captured into a quoted variable. **This file is committed,
  but `expo prebuild --clean` regenerates it — reapply after any clean prebuild.**
- `node_modules/expo-updates/ios/EXUpdates.podspec` — `bash -l -c "$PODS_TARGET_SRCROOT/..."`, now
  single-quoted around the path.
- `node_modules/expo-constants/ios/EXConstants.podspec` — same pattern, fixed preemptively.

### 4. Swift compile errors in node_modules (Xcode 26.3 toolchain)

- `expo-modules-jsi/apple/Sources/ExpoModulesJSI/Coding/JavaScriptCodable+Date.swift` —
  `abs(milliseconds) <= maxJavaScriptDateMilliseconds` was *"type of expression is ambiguous"*.
  Rewritten as an explicitly typed `let magnitude: Double = milliseconds.magnitude`.
- `expo-modules-core/ios/Core/Events/EventEmitter.swift` — `nonisolated(unsafe) weak let emitter`
  still tripped *"sending 'emitter' risks causing data races"* under strict concurrency. Replaced
  with an `@unchecked Sendable` weak box (`UncheckedSendableWeakEmitterBox`).

### 5. Metro choked on `.env.supabase.local`

With the native build fixed, the app launched but the JS bundle failed with
`SyntaxError: .env.supabase.local: Invalid left-hand side in assignment expression`.

Expo's virtual env module (`@expo/metro-config/build/transform-worker/transform-worker.js`) builds
its env from:

```js
require.context(projectRoot, false, /^\.\/\.env/)
```

That pulls **every** root-level file starting with `.env` into the module graph, but only files
matching `/(^|\/)\.env(\.(local|(development|production)(\.local)?))?$/` are parsed as env files.
`.env.supabase.local` matched the first pattern and not the second, so Metro handed it to Babel as
JavaScript. (`.env.example` is unaffected — `example` isn't one of Metro's `additionalExts`, so it
never enters the graph.)

Fixed by renaming the file so it no longer starts with `.env`:

```
.env.supabase.local  →  .supabase.local.env
```

`.gitignore`, `scripts/audit-rls-policies.sh`, `web/.gitignore`, `web/scripts/audit-rls-policies.sh`
and both `MIGRATION_PLAN.md` files were updated to match.

> **Rule of thumb:** never put a non-standard `.env.*` file in the project root. Only `.env`,
> `.env.local`, `.env.development[.local]` and `.env.production[.local]` are safe there. Anything
> else either breaks the bundle or risks being bundled into the app.

## ⚠️ The node_modules edits are not persistent

Items 3 and 4 patch files under `node_modules/`. Any `npm install` that refreshes those packages
wipes them and the build breaks again with the exact errors above. To make them stick, add
`patch-package` (not currently a dependency) and commit the patches:

```bash
npm i -D patch-package
```

```bash
npx patch-package expo-modules-jsi expo-modules-core expo-updates expo-constants
```

Then add `"postinstall": "patch-package"` to the `scripts` block in `package.json`.

## Order of operations after a clean checkout

1. `npm install`
2. Reapply the `node_modules` patches (or rely on `patch-package` once it's set up).
3. `cd ios && LANG=en_US.UTF-8 pod install`
4. `npm run ios:device`
5. Trust the developer profile on the iPhone, then rerun step 4.

## Verified working

A Debug build was installed and launched on a physical iPhone (iOS 26.3.1), with Metro bundling
`expo-router/entry.js` (3676 modules) and hot reload connected.
