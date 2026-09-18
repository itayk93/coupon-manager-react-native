# Hebrew Kuponi wordmarks

Approved transparent artwork: color / white, horizontal / stacked. Source PNGs retain the original generated artwork. Run `python3 scripts/build-kuponi-wordmarks.py` (Pillow) to export trimmed, padded assets without changing artwork or stretching its proportions.

- Authentication screens and public content header: color horizontal.
- Native splash and BrandLaunchAnimation: color stacked, on #e8f2fd.
- Public logo and newsletter logo endpoint: color horizontal.
- iOS AppLogoView and Android widget layouts: white horizontal. iOS uses a new KuponiWordmarkWhite image set; Android a new kuponi_wordmark_white drawable. White stacked remains available for future taller layouts.
- Launcher, PWA and favicon keep the approved face-only icon for legibility at small sizes.

English assets are retained: existing CouponLogo/CouponLogoWidget image sets, Android widget_logo/widget_brand_wordmark, design/assets/brand-legacy, and the previous newsletter logo in assets/branding/english/newsletter-logo.png. No English source asset is deleted. `build-kuponi-icons.py` invokes the wordmark exporter last, so regenerating icons cannot revert the wordmarks.

Native splash/widget updates require a new iOS/Android build and installation. Web export does not deploy native widgets. No on-device verification was performed in this environment.
