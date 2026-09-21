# Kuponi face identity

Approved direction: blue Kuponi face on pale brand tint (#e8f2fd); transparent favicon.

Masters are generated artwork: `icon-source.png` (opaque) and `face-transparent.png` (alpha). Export with `python scripts/build-kuponi-icons.py` (Pillow). Raster background approximates the palette; padded adaptive/maskable backgrounds use exact #e8f2fd.

Exports cover Expo icons, PWA any/maskable, Apple touch, transparent PNG/ICO favicons, checked-in iOS/Android launcher icons, extension icon catalogs, and native splash images. Login and launch animation use `assets/brand-logo-kuponi.png`. Retired wordmarks and their dedicated generator were removed; Git history preserves them.

Maskable/adaptive foreground occupies 62% of the canvas to retain the whole face under circular masks. Native installed apps need a new binary; OTA cannot replace launcher assets. PWA icon URLs carry a revision query; existing iOS home-screen shortcuts may require removal and re-addition after deployment. No native device build was performed here.

Native splash, BrandLaunchAnimation and PWA launch background use #e8f2fd. Product screens keep their warm cream theme.

## Balanced padding revision (kuponi-face-3)

The original diagonal face is intentional. The transparent face master is restored to the original artwork. The opaque icon was edited with the built-in image editor with the prompt: preserve the original tilted head and expression, change only outer spacing on pale blue. The exporter normalizes its blue silhouette to an 896px square footprint on a 1024px canvas with 64px clearance on each side, retaining the diagonal orientation. Web icon URLs use revision 3.

## Notification mark

`assets/notification-icon.png` is the same face reduced to a mask: white body and eye whites in one shape, with the brows, pupils and smile punched out as transparency. Android composites a status-bar icon from the alpha channel alone, so the colour face — which `app.json` pointed at until now — arrives as a featureless white blob. The exporter derives the mask from `face-transparent.png`, drops the thin shading ring around each eye that would otherwise downscale into grey noise, and thickens the remaining features so they still read at 24px.

`build-kuponi-icons.py` writes the 512px master the expo-notifications plugin resizes, `android/app/src/main/res/drawable-*/notification_icon.png` at the five densities that plugin generates (24/36/48/72/96), and `public/notification-badge.png` for the Web Push badge, which browsers mask the same way. The checked-in manifest and `colors.xml` carry the four `*_notification_icon` / `*_notification_color` meta-data entries and the `notification_icon_color` tint (`#1f6fd1`) that prebuild would add. `src/lib/notificationIcon.test.ts` guards the chain.

Android notification icons are native resources: installed apps need a new binary, OTA cannot replace them. The web badge ships with the next web deploy. iOS takes its notification artwork from the app icon and needs nothing here.
