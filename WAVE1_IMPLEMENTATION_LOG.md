# Wave 1 Implementation Log

Date: 2026-07-05

## Scope

Implemented the first design-stabilization wave from `DESIGN_UPGRADE_PLAN.md`.

## Changes

- Fixed the mobile stats modal layout so the four KPI cards wrap into a stable 2-column grid instead of being forced into one compressed row.
- Protected KPI values from clipping by using responsive font sizing, isolated LTR currency rendering, and no-wrap overflow handling.
- Moved app to the shared Sonner wrapper and placed toasts at the bottom center with an offset, so login and success messages no longer cover the dashboard title/header area.
- Replaced the landing-page negative social proof text `₪0` with a business-value statement.
- Replaced landing-page emoji icons with consistent Lucide icons to reduce the amateur visual feel and align with the existing React icon stack.

## Files Changed

- `src/App.tsx`
- `src/components/ui/sonner.tsx`
- `src/pages/landing/LandingPage.tsx`
- `src/index.css`

## Verification

- `npm run build` passed.
- Playwright mobile check passed at 390x844:
  - stats modal rendered as a stable 2x2 KPI grid.
  - all KPI values reported `clipped: false`.
- Captured mobile screenshots after the change:
  - `playwright-artifacts/wave1-dashboard-mobile.png`
  - `playwright-artifacts/wave1-stats-modal-mobile.png`
