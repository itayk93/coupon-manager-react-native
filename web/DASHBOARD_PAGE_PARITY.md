# Dashboard Page Parity

Date: 2026-07-05

## Scope

Copied the dashboard page shown in the provided screenshot into the React/Vite implementation, with matching desktop and mobile structure:

- Dark top navigation bar.
- Right-side dashboard sidebar on desktop.
- Mobile drawer navigation.
- Welcome heading and daily summary subtitle.
- Four dashboard KPI cards.
- Recent coupons list.

Marketplace/sale/purchase pages and links were intentionally excluded.

## Implemented

### Layout

- Reworked `src/components/layout/AppLayout.tsx`.
- Sidebar now appears on the right on desktop.
- Sidebar includes only:
  - דשבורד
  - הקופונים שלי
  - סטטיסטיקות
  - שיתופים
  - הגדרות חשבון
  - פאנל ניהול, only for admins
  - יציאה מהחשבון
- Removed footer rendering from the dashboard shell to match the screenshot.
- Added mobile drawer behavior for narrow screens.

### Top Bar

- Reworked `src/components/layout/Navbar.tsx`.
- Matches the screenshot pattern:
  - `Coupon Master` brand.
  - Theme icon.
  - Notification bell with red dot.
  - Circular user avatar with first initial.
  - Mobile menu button.

### Dashboard Content

- Replaced `src/pages/dashboard/Dashboard.tsx`.
- Uses real coupon data from `useCoupons`.
- Excludes coupons marked `is_for_sale`.
- Calculates:
  - Available balance.
  - Active coupons.
  - Total used value.
  - Coupons expiring in the next 30 days.
- Recent coupons list shows company, remaining balance, expiration/status, and circular company initial.

### Styling

- Updated `src/index.css`.
- Added responsive dashboard-specific CSS for:
  - Desktop sidebar + topbar layout.
  - 4-column KPI card grid on desktop.
  - 2-column tablet layout.
  - 1-column mobile layout.
  - Mobile recent coupon cards.
  - Mobile navigation drawer.

## Explicit Exclusions

The following original project areas were not copied into this dashboard page:

- Coupon marketplace.
- Sell coupon flows.
- Buy coupon flows.
- Transaction pages.
- Coupon request marketplace flows.

## Validation

Commands run:

```bash
npm run build
npm test
npm run test:e2e -- --project=chromium
```

Results:

- Build passed.
- Vitest passed: 3 password-hash compatibility tests.
- Playwright passed: landing page, desktop dashboard, and mobile dashboard drawer.

Generated visual check screenshots:

- `/tmp/coupon-dashboard-desktop.png`
- `/tmp/coupon-dashboard-mobile.png`

## Notes

The page still depends on live Supabase data through the existing `useCoupons` hook. When logged in with a real legacy user, the dashboard values and recent coupons come from that user's decrypted coupon rows.
