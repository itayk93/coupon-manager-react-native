# Running CouponMaster on a phone

Practical commands for getting the app onto a real device. If a build fails, check
[IOS_BUILD_FIXES.md](IOS_BUILD_FIXES.md) — every failure hit so far is recorded there with its cause.

**Expo Go cannot run this app.** It uses `expo-dev-client`, its own bundle identifier, Face ID
entitlements and a custom icon/splash — none of which Expo Go can carry. Every option below builds a
real app instead.

Two things to know before you start:

- Always prefix commands with `LANG=en_US.UTF-8`. Without a UTF-8 locale the `pod install` that
  `expo run:ios` triggers crashes on a CocoaPods encoding bug. Add `export LANG=en_US.UTF-8` to your
  `~/.zshrc` and you can drop the prefix everywhere.
- The iPhone's UDID used below is `00008140-00126D810CD8801C`. List devices with
  `xcrun devicectl list devices`.

---

## iOS

### Option A — development build (for working on the app)

The app connects to Metro on your Mac, so JS changes reload instantly. Requires the computer.

Build and install (only needed when native code or dependencies change):

```bash
LANG=en_US.UTF-8 npm run ios:device
```

Afterwards, just start Metro and open the app:

```bash
npm start
```

The first launch shows the Expo Dev Launcher; pick your Mac from "Development servers", or enter the
URL manually.

### Option B — Release build (standalone, no computer)

The JS bundle is embedded in the app, so it launches straight into the UI with no Dev Launcher and
no Metro. This is what you want for actually *using* the app.

```bash
LANG=en_US.UTF-8 npx expo run:ios --device 00008140-00126D810CD8801C --configuration Release
```

The build succeeds but **the install step fails** with
`RangeError [ERR_OUT_OF_RANGE]: The value of "offset" is out of range` — a bug in `@expo/cli`'s own
file uploader, triggered by the longer paths in a Release bundle. Ignore it and install with Apple's
tool instead:

```bash
xcrun devicectl device install app --device 00008140-00126D810CD8801C ~/Library/Developer/Xcode/DerivedData/CouponMaster-*/Build/Products/Release-iphoneos/CouponMaster.app
```

```bash
xcrun devicectl device process launch --terminate-existing --device 00008140-00126D810CD8801C com.itaykarkason.couponmaster
```

Or just tap the icon on the phone. To watch the app's logs (useful if it crashes on launch), add
`--console`:

```bash
xcrun devicectl device process launch --console --terminate-existing --device 00008140-00126D810CD8801C com.itaykarkason.couponmaster
```

### First install on a new device

The install succeeds but the launch fails with
`FBSOpenApplicationErrorDomain error 3` until you trust the certificate:

**Settings → General → VPN & Device Management →** the `Apple Development: itayk93@gmail.com`
profile **→ Trust**. Then launch again.

### ⚠️ The 7-day expiry

The signing team is a **free Apple personal team**, so every install stops working 7 days after it
was built. To keep using the app you have to plug the iPhone in and rebuild. There is no way around
this without a paid Apple Developer Program membership ($99/year) — it's an Apple limit, not an Expo
one.

With a paid account you'd also unlock EAS Build, which is the proper way to install once and forget:

```bash
npx eas-cli device:create                              # one-time, registers the iPhone
```

```bash
npx eas-cli build --profile preview --platform ios     # installs from a link/QR, lasts a year
```

```bash
npx eas-cli update --channel preview                   # ship JS changes with no new build
```

The profiles are already defined in [eas.json](../eas.json), and the account is already linked
(`itaykar` / project `coupon-master`).

---

## Android

**Not yet tested.** There's no `android/` directory in the repo — it gets generated on first build.
The Android config (package name, adaptive icon, camera/notification permissions) is already in
[app.json](../app.json), so it should work, but treat the first run as exploratory.

Android is considerably easier than iOS here: no signing team, no 7-day expiry, no per-device
registration. A debug build installs and runs indefinitely.

### Setup

The Android SDK is already installed at `~/Library/Android/sdk`, but `adb` isn't on your PATH. Add
this to `~/.zshrc`:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

You'll also need a JDK 17+ (`brew install --cask temurin@17` if `java -version` fails).

On the phone: enable **Developer options** (Settings → About phone → tap "Build number" 7 times),
then turn on **USB debugging**. Plug it in and confirm it's visible:

```bash
adb devices
```

### Development build

```bash
npm run android
```

This generates `android/` on first run, builds, installs and launches, then connects to Metro the
same way iOS does.

### Release build (standalone)

```bash
npx expo run:android --variant release
```

The APK lands at `android/app/build/outputs/apk/release/app-release.apk` and installs with:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

A debug-signed release APK runs fine on your own device. For sharing it with anyone else, or for the
Play Store, build through EAS instead — and unlike iOS, Android needs no paid membership for
internal distribution:

```bash
npx eas-cli build --profile preview --platform android
```

### If something breaks

Read the logs first — Android surfaces JS errors clearly:

```bash
adb logcat *:S ReactNative:V ReactNativeJS:V
```

The iOS fixes in [IOS_BUILD_FIXES.md](IOS_BUILD_FIXES.md) are Xcode/CocoaPods-specific and shouldn't
apply. The one that might: Gradle also dislikes spaces in paths, so if a build fails with a
truncated path, that's the same root cause.

---

## After a fresh clone

1. `npm install` — the `postinstall` hook reapplies the `node_modules` patches automatically.
2. `cd ios && LANG=en_US.UTF-8 pod install`
3. Build with one of the options above.

If you ever run `npx expo prebuild -p ios --clean`, it regenerates `ios/CouponMaster.xcodeproj/project.pbxproj`
and wipes the quoting fix in the *Bundle React Native code and images* phase. Reapply it — see item 3
in [IOS_BUILD_FIXES.md](IOS_BUILD_FIXES.md).
