# Hebrew Kuponi wordmarks

Approved transparent artwork: color / white, horizontal / stacked. Source PNGs retain the original generated artwork. Run `python3 scripts/build-kuponi-wordmarks.py` (Pillow) to export trimmed, padded assets without changing artwork or stretching its proportions.

- Authentication screens and public content header: color horizontal.
- Native splash, BrandLaunchAnimation and the PWA launch screens: color stacked, on #e8f2fd.
- Public logo and newsletter logo endpoint: color horizontal.
- iOS AppLogoView and Android widget layouts: white horizontal. iOS uses a new KuponiWordmarkWhite image set; Android a new kuponi_wordmark_white drawable. White stacked remains available for future taller layouts.
- Launcher, PWA and favicon keep the approved face-only icon for legibility at small sizes.

English assets are retained: existing CouponLogo/CouponLogoWidget image sets, Android widget_logo/widget_brand_wordmark, design/assets/brand-legacy, and the previous newsletter logo in assets/branding/english/newsletter-logo.png. No English source asset is deleted. `build-kuponi-icons.py` invokes the wordmark exporter last, so regenerating icons cannot revert the wordmarks.

Native splash/widget updates require a new iOS/Android build and installation. Web export does not deploy native widgets. No on-device verification was performed in this environment.

## Link previews

`public/og-image.png` and `public/social-preview.png` are the wordmark centred on the brand tint at 1200x630, generated here rather than drawn, so they cannot drift from the identity the way the retired English artwork did. They are what a shared link shows in iOS, WhatsApp, Slack and search results.

Those readers never run the page's JavaScript, and the web build ships `web.output: "single"` — Expo's stock template with every head tag added at runtime. So `src/lib/webHead.json` is the one source for those tags, `scripts/inject-web-head.mjs` writes them into `dist/index.html` during the Vercel build, and `applyWebDocumentHead` still applies them at runtime for the dev server. Left to runtime alone there was no icon and no preview image in the served HTML at all, and iOS filled the gap by tiling a mascot frame across a square. `src/lib/webDocumentHead.test.ts` guards it, including that every URL named there is a file `public/` actually holds.

## Launch screens

iOS will not draw a launch screen for an installed web app. It ignores the
manifest's `background_color`, so a device that matches none of the
`apple-touch-startup-image` links opens the app on a white page and holds it
there until the bundle has booted — the one moment the app is most obviously
not the native one.

`python3 scripts/build-pwa-splash.py` (or `npm run pwa-splash`) draws them: the
stacked wordmark at 240pt on #e8f2fd, the same artwork, width and background
`app.json` hands `expo-splash-screen`, at every iPhone and iPad size in both
orientations. It writes `public/splash/` and `src/lib/webHeadStartupImages.json`,
the links `inject-web-head.mjs` puts in the served HTML and
`applyWebDocumentHead` adds at runtime. Rerun it after changing the wordmark,
and add a row to its `DEVICES` table when Apple ships a new screen size — a
size that is missing is a white launch, not a wrong one.

The same script writes `public/splash/wordmark.png` for the launch screen
`injectBootSplash` puts in the document itself. iOS shows its launch image only
until the page's first paint, and the page Expo ships is an empty white root
until React mounts, so without it the branded launch would end in a white
screen — which is most of the wait on a cold start, and all of it on Android
and the desktop. `hideWebBootSplash` fades it out once the app is ready.
`src/lib/webDocumentHead.test.ts` checks that every link names a file the site
serves, at exactly the pixel size its media query claims.
