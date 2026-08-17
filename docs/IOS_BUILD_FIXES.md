# iOS build fixes — what broke and why

A record of every failure hit while getting CouponMaster onto a physical iPhone with Expo SDK 57 /
React Native 0.86 / Xcode 26.3, and what fixed each one. For the commands to actually run the app,
see [RUNNING_ON_DEVICE.md](RUNNING_ON_DEVICE.md).

Most of these trace back to one thing: **the project path contains a space** (`Python Projects`).
Several Xcode script phases don't quote paths and break on it — one of them silently. Moving the
repo to a space-free path would eliminate this entire class of problem.

## Environment requirements

| Requirement | Why |
| --- | --- |
| `export LANG=en_US.UTF-8` in your shell profile | CocoaPods 1.17 crashes with `Unicode Normalization not appropriate for ASCII-8BIT` on any `pod install` without a UTF-8 locale. `expo prebuild` runs `pod install` internally, so it fails there too. |
| Project path contains a space (`.../Python Projects/...`) | Several Xcode script phases don't quote paths and break on it. See "Space-in-path bugs" below. Moving the repo to a space-free path removes this whole class of problems permanently. |
| Device must trust the developer certificate | After the first install: Settings → General → VPN & Device Management → the `Apple Development: <your email>` profile → Trust. Without it the install succeeds but the launch fails with `FBSOpenApplicationErrorDomain error 3` / "invalid code signature, inadequate entitlements or its profile has not been explicitly trusted". |
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
- `node_modules/expo-constants/scripts/get-app-config-ios.sh` — `basename $PROJECT_DIR` unquoted.
  This one fails **silently**: `basename` takes the second word as a suffix argument and returns
  `Python` instead of `Pods`, so the script concludes it isn't running in a Pods project and exits 0
  without writing `app.config`. The build reports no error, and the Release app then dies on launch
  with `expo-linking needs access to the expo-constants manifest`. Debug is unaffected — the
  manifest comes from the dev server there — so this only shows up in a Release build.

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

## The node_modules fixes are kept by patch-package

Items 3 and 4 patch files under `node_modules/`, which any `npm install` would wipe. They are now
committed as patches and reapplied automatically:

- `patches/expo-modules-jsi+57.0.4.patch`
- `patches/expo-modules-core+57.0.11.patch`
- `patches/expo-updates+57.0.14.patch`
- `patches/expo-constants+57.0.11.patch`

`package.json` runs `"postinstall": "patch-package"`, so a fresh `npm install` — including the one
EAS Build runs in the cloud — reapplies all four. Without this, a cloud build fails on the Swift
errors in item 4.

If you change one of those files again, regenerate its patch:

```bash
npx patch-package <package-name>
```

> Before regenerating the `expo-modules-jsi` patch, delete `node_modules/expo-modules-jsi/apple/.DerivedData`,
> `Products`, `.generated` and `.swiftpm`. The xcframework build script writes ~110 MB of artifacts
> there and patch-package would otherwise bake them into the patch.

## Verified working

A Debug build and a standalone Release build were both installed and launched on a physical iPhone
(iOS 26.3.1). Debug bundles `expo-router/entry.js` (3676 modules) over Metro with hot reload;
Release runs off the embedded bundle with no computer attached.
