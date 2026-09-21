# Hebrew Kuponi wordmarks

Approved transparent artwork: color / white, horizontal / stacked. Source PNGs retain the original generated artwork. Run `python3 scripts/build-kuponi-wordmarks.py` (Pillow) to export trimmed, padded assets without changing artwork or stretching its proportions.

- Authentication screens and public content header: color horizontal.
- Native splash and BrandLaunchAnimation: color stacked, on #e8f2fd.
- Public logo and newsletter logo endpoint: color horizontal.
- iOS AppLogoView and Android widget layouts: white horizontal. iOS uses a new KuponiWordmarkWhite image set; Android a new kuponi_wordmark_white drawable. White stacked remains available for future taller layouts.
- Launcher, PWA and favicon keep the approved face-only icon for legibility at small sizes.

English assets are retained: existing CouponLogo/CouponLogoWidget image sets, Android widget_logo/widget_brand_wordmark, design/assets/brand-legacy, and the previous newsletter logo in assets/branding/english/newsletter-logo.png. No English source asset is deleted. `build-kuponi-icons.py` invokes the wordmark exporter last, so regenerating icons cannot revert the wordmarks.

Native splash/widget updates require a new iOS/Android build and installation. Web export does not deploy native widgets. No on-device verification was performed in this environment.

## Link previews

`public/og-image.png` and `public/social-preview.png` are the wordmark centred on the brand tint at 1200x630, generated here rather than drawn, so they cannot drift from the identity the way the retired English artwork did. They are what a shared link shows in iOS, WhatsApp, Slack and search results.

Those readers never run the page's JavaScript, and the web build ships `web.output: "single"` — Expo's stock template with every head tag added at runtime. So `src/lib/webHead.json` is the one source for those tags, `scripts/inject-web-head.mjs` writes them into `dist/index.html` during the Vercel build, and `applyWebDocumentHead` still applies them at runtime for the dev server. Left to runtime alone there was no icon and no preview image in the served HTML at all, and iOS filled the gap by tiling a mascot frame across a square. `src/lib/webDocumentHead.test.ts` guards it, including that every URL named there is a file `public/` actually holds.
