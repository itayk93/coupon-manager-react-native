# Wave 2 Implementation Log

Date: 2026-07-05

## Scope

Implemented the foundation of the shared design system from `DESIGN_UPGRADE_PLAN.md`.

## Design Decisions

- Kept the product in a calm coupon-wallet style instead of adopting the skill-generated Web3/orange recommendation.
- Standardized on one primary brand color, one success/accent color, neutral surfaces, one radius, and a shared shadow scale.
- Preserved the existing React/Vite/Tailwind/shadcn structure and avoided a rewrite.

## Changes

- Added global Coupon Master design tokens in `src/index.css`.
- Unified dashboard action buttons:
  - Primary action: `הוספת קופון מהירה`
  - Secondary actions: quiet soft-primary style
- Updated mobile bottom navigation to a glassy, touch-friendly bar with a clearer active tab.
- Shortened mobile nav labels so they fit better in five tabs.
- Unified company cards and coupon cards around the same radius, border, shadow, hover, and surface treatment.
- Updated coupon progress and text colors to use shared semantic tokens.

## Files Changed

- `src/components/layout/AppLayout.tsx`
- `src/index.css`

## Verification

- `npm run build` passed.
- Playwright mobile check passed at 390x844:
  - dashboard `scrollWidth` equals `clientWidth` (`390`), so there is no horizontal overflow.
  - bottom nav renders 5 items with 56px touch height.
  - dashboard action buttons now render as 2 secondary soft-primary actions and 1 primary action.
  - coupons page `scrollWidth` equals `clientWidth` (`390`).
  - coupon cards use the shared 8px radius.
- Captured mobile screenshots:
  - `playwright-artifacts/wave2-dashboard-mobile.png`
  - `playwright-artifacts/wave2-coupons-mobile-viewport.png`
