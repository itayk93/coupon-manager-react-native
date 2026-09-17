# Kuponi face identity

Approved direction: blue Kuponi face on pale brand tint (#e8f2fd); transparent favicon.

Masters are generated artwork: `icon-source.png` (opaque) and `face-transparent.png` (alpha). Export with `python scripts/build-kuponi-icons.py` (Pillow). Raster background approximates the palette; padded adaptive/maskable backgrounds use exact #e8f2fd.

Exports cover Expo icons, PWA any/maskable, Apple touch, transparent PNG/ICO favicons, checked-in iOS/Android launcher icons, extension icon catalogs, and native splash images. Login and launch animation use `assets/brand-logo-kuponi.png`. Old wordmark files remain archival and their old generation script is not part of this build.

Maskable/adaptive foreground occupies 62% of the canvas to retain the whole face under circular masks. Native installed apps need a new binary; OTA cannot replace launcher assets. PWA icon URLs carry a revision query; existing iOS home-screen shortcuts may require removal and re-addition after deployment. No native device build was performed here.
