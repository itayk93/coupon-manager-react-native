# Kuponi face identity

Approved direction: blue Kuponi face on pale brand tint (#e8f2fd); transparent favicon.

Masters are generated artwork: `icon-source.png` (opaque) and `face-transparent.png` (alpha). Export with `python scripts/build-kuponi-icons.py` (Pillow). Raster background approximates the palette; padded adaptive/maskable backgrounds use exact #e8f2fd.

Exports cover Expo icons, PWA any/maskable, Apple touch, transparent PNG/ICO favicons, checked-in iOS/Android launcher icons, extension icon catalogs, and native splash images. Login and launch animation use `assets/brand-logo-kuponi.png`. Retired wordmarks and their dedicated generator were removed; Git history preserves them.

Maskable/adaptive foreground occupies 62% of the canvas to retain the whole face under circular masks. Native installed apps need a new binary; OTA cannot replace launcher assets. PWA icon URLs carry a revision query; existing iOS home-screen shortcuts may require removal and re-addition after deployment. No native device build was performed here.

Native splash, BrandLaunchAnimation and PWA launch background use #e8f2fd. Product screens keep their warm cream theme.

## Balanced padding revision (kuponi-face-3)

The original diagonal face is intentional. The transparent face master is restored to the original artwork. The opaque icon was edited with the built-in image editor with the prompt: preserve the original tilted head and expression, change only outer spacing on pale blue. The exporter normalizes its blue silhouette to an 896px square footprint on a 1024px canvas with 64px clearance on each side, retaining the diagonal orientation. Web icon URLs use revision 3.
