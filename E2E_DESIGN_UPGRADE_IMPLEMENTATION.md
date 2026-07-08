# E2E Design Upgrade Implementation

Date: 2026-07-05

## Scope

Implemented the design upgrade roadmap end to end across the practical UI surfaces in the current React/Vite app.

## Completed Stages

### Wave 1: Fix And Clean

- Fixed the mobile stats modal KPI grid so it renders as 2x2 instead of one compressed row.
- Prevented KPI currency/value clipping on mobile.
- Moved Sonner toasts to the bottom center with offset from the mobile nav.
- Removed negative `₪0` social proof from the landing page.
- Replaced landing-page emoji icons with Lucide icons.

### Wave 2: Shared Design System

- Added shared Coupon Master design tokens in CSS:
  - primary color
  - accent/success color
  - surfaces
  - muted text
  - borders
  - 8px radius
  - shared shadow scale
- Unified dashboard action colors:
  - one primary action
  - secondary actions use quiet soft-primary styling
- Upgraded the mobile bottom nav to a glassy, touch-friendly bar with clear active state.
- Shortened mobile nav labels so five tabs fit cleanly.
- Unified company cards and coupon cards around the same surface, border, radius and shadow language.
- Added dark-mode token values for the new design system.

### Wave 3: Premium Wallet Experience

- Reworked the dashboard hero into a wallet-style Bento section:
  - large balance card
  - greeting and wallet context
  - active coupon count
  - KPI cards for potential savings, used value and expiring-soon count
- Made the coupon list more compact:
  - horizontal coupon header
  - smaller logo
  - tighter content spacing
  - mobile icon-only action row with accessible `aria-label`s
- Upgraded the company modal:
  - richer company header
  - coupon cards instead of loose rows
  - consistent primary/secondary action buttons
- Improved statistics readability:
  - chart labels get more vertical space
  - chart panels use shared card styling
  - summary KPI cards use shared styles and safer number sizing

## Files Changed

- `src/App.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/pages/dashboard/Dashboard.tsx`
- `src/pages/coupons/CouponsList.tsx`
- `src/pages/landing/LandingPage.tsx`
- `src/pages/statistics/Statistics.tsx`
- `src/index.css`

## Verification

- `npm run build` passed.
- Playwright mobile verification passed at `390x844`.
- Playwright desktop verification passed at `1440x1000`.
- No horizontal overflow found on:
  - dashboard
  - coupons
  - statistics
- Mobile coupon action buttons are `44px` high and have accessible labels.
- Mobile coupon card height was reduced from about `319px` to about `269px`.

## Screenshots

Mobile:

- `playwright-artifacts/e2e-dashboard-wallet-mobile.png`
- `playwright-artifacts/e2e-company-modal-mobile.png`
- `playwright-artifacts/e2e-coupons-compact-mobile-v2.png`
- `playwright-artifacts/e2e-statistics-mobile.png`

Desktop:

- `playwright-artifacts/e2e-dashboard-desktop.png`
- `playwright-artifacts/e2e-coupons-desktop.png`
- `playwright-artifacts/e2e-statistics-desktop.png`

## Known Follow-Up

- The coupons page still renders all 335 coupons at once. For the next performance pass, add list virtualization or pagination.
- The Vite build still warns about large chunks. This is existing bundle-size debt and should be handled with route-level code splitting.
