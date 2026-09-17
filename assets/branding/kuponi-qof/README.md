# Kuponi qof app-logo concept

`kuponi-qof-brand.png`: generated opaque RGB PNG, 1254 × 1254.

The Hebrew ק combines a coupon notch and small expressive eyes inspired by Kuponi. Prompt palette comes from `src/lib/theme.ts`: brand blue #1f6fd1, warm white #faf9f6, dark blue #154a8f. This generated raster has slight color/texture variation; those hex values are design targets, not guaranteed uniform pixel values.

Uploaded for integration review, not wired into Expo or the PWA. Preserve this source. Generate app-specific sizes from it only when integrating; verify small-size legibility, safe areas, favicon, PWA manifest, Expo icon/adaptive icon and splash separately. Do not use an app-icon square as an automatic replacement for every in-app wordmark.

Based on integration commit 22d4023, which already includes animation fix 9aa3fe4 and Claude's parallel crop/resolution changes. No animation files were changed in this logo handoff. Use current manifest measurements, not earlier chat values, when checking the merged animation.
