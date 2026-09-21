# Kuponi face identity

Approved direction: blue Kuponi face on pale brand tint (#e8f2fd); transparent favicon.

Masters are generated artwork: `icon-source.png` (opaque) and `face-transparent.png` (alpha). Export with `python scripts/build-kuponi-icons.py` (Pillow). Raster background approximates the palette; padded adaptive/maskable backgrounds use exact #e8f2fd.

Exports cover Expo icons, PWA any/maskable, Apple touch, transparent PNG/ICO favicons, checked-in iOS/Android launcher icons, extension icon catalogs, and native splash images. Login and launch animation use `assets/brand-logo-kuponi.png`. Retired wordmarks and their dedicated generator were removed; Git history preserves them.

Maskable/adaptive foreground occupies 62% of the canvas to retain the whole face under circular masks. Native installed apps need a new binary; OTA cannot replace launcher assets. PWA icon URLs carry a revision query; existing iOS home-screen shortcuts may require removal and re-addition after deployment. No native device build was performed here.

Native splash, BrandLaunchAnimation and PWA launch background use #e8f2fd. Product screens keep their warm cream theme.

## Upright launcher revision (kuponi-face-2)

The face and opaque masters now use an upright, front-facing head, level eyes and eyebrows, and a centered smile. Generated with the built-in image editor from the existing Kuponi artwork. Prompt: preserve the blue 3D identity while correcting tilt, balancing the rounded-square silhouette and eye geometry, and centering the smile; export the opaque version on pale blue and the matching transparent face. Regenerate platform sizes with the existing icon exporter. Web icon revision queries are bumped to invalidate cached assets.
