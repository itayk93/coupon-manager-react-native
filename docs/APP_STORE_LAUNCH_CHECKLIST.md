# App Store launch checklist

Updated: 2026-09-01

This file is release evidence. Never commit reviewer passwords, API keys, recovery codes, or production customer data.

## Automated gates

- `npm test` — unit and contract tests.
- `npm run typecheck` — native TypeScript contract.
- `npm run e2e:account-privacy` — destructive test against one throwaway Supabase account. Requires `.env.supabase.local`; creates and deletes only an `e2e+account-privacy-*` account.
- `maestro test .maestro/public-launch-smoke.yaml` — public legal-route smoke on an installed production-like build.
- `maestro test .maestro/account-deletion.yaml` — UI deletion flow. Requires a dedicated disposable account in `E2E_DELETE_ACCOUNT_EMAIL` / `E2E_DELETE_ACCOUNT_PASSWORD`.
- Existing server suites: coupon vault, activity log, notifications, geo, referral, newsletter.

Run server E2E only with explicit approval for the target project. These suites mutate the real database while running. Newsletter E2E also sends a real preview email.

## 1. Developer accounts

- [x] iOS bundle ID: `com.itaykarkason.couponmaster`.
- [x] Apple team configured in `app.json`.
- [x] Android package: `com.itaykarkason.couponmaster`.
- [x] EAS production build profiles.
- [ ] Confirm Apple Developer membership is active.
- [ ] Confirm Play Console identity and payments profile are verified.
- [ ] Confirm agreements, tax, and banking forms have no pending action.

Evidence owner: release operator. Store screenshots required because account state cannot be proven by source code.

## 2. Store media

- [ ] Capture current iPhone 6.9-inch screenshots.
- [ ] Capture current iPhone 6.5-inch screenshots if App Store Connect requests them.
- [ ] Capture Android phone screenshots.
- [ ] Cover login, dashboard, coupon wallet, coupon detail, scanner/AI import, sharing, statistics, and privacy controls.
- [ ] Produce 15–30 second product demo without real coupon codes, emails, or notifications.
- [ ] Verify every caption matches current UI and no claim promises unsupported behavior.

Source media belongs under `store-assets/ios`, `store-assets/android`, and `store-assets/video`. Do not reuse onboarding or brand animation as product-demo evidence.

## 3. In-app account deletion

- [x] Settings action and irreversible confirmation.
- [x] Server erasure of app data and Auth identity.
- [x] Profile Storage deletion.
- [x] Local private-data cleanup after sign-out.
- [x] Dedicated account privacy E2E added.
- [x] Native UI deletion flow added.
- [ ] Run E2E against release Supabase and attach output to release record.

## 4. Reviewer account

- [ ] Create a dedicated verified account in production named `App Store Reviewer`.
- [ ] Seed two non-sensitive demo coupons: one active, one near expiry.
- [ ] Disable MFA and biometric lock for reviewer account.
- [ ] Confirm login from a clean device.
- [ ] Put credentials only in App Store Connect / Play Console review notes or approved secret manager.
- [ ] Rotate password after review completes.

Review notes must explain scanner permission, location permission, notification permission, account deletion path, and any feature unavailable without a physical device.

## 5. Public legal URLs

- [x] Privacy: `https://coupons.itaykarkason.com/privacy`.
- [x] Terms: `https://coupons.itaykarkason.com/terms`.
- [x] Support: `https://coupons.itaykarkason.com/issues`.
- [ ] Verify all return HTTP 200 on production before submission.
- [ ] Enter URLs in both store dashboards.

## 6. Data Safety / App Privacy

Declare behavior, not only dependencies. Recheck after every permission, SDK, analytics, or AI change.

- Account data: name, email, account identifiers, authentication provider.
- User content: coupon codes, voucher metadata, notes, profile image, support messages.
- Purchase/history data entered by user: coupon values, usage, sale records.
- Location: optional precise device location for user-triggered map features; on-device geofencing when enabled.
- Diagnostics/analytics: app actions, device description, IP, derived city/region, error and security events.
- Contacts entered by user: sharing recipient and optional buyer details.
- AI processing: selected text/images sent through server to OpenAI for extraction; validate current retention contract.
- Push identifiers: Expo/web subscription identifiers.

Required checks:

- [ ] Apple App Privacy answers match policy version 3.0.
- [ ] Google Data Safety answers match policy version 3.0.
- [ ] iOS Privacy Manifest matches all required-reason APIs from final archive.
- [ ] Data is marked as encrypted in transit where applicable.
- [ ] Account deletion URL/path supplied to Google.
- [ ] Advertising and cross-app tracking remain declared as not used unless product changes.

## 7. Terms of Service

- [x] General terms route added.
- [x] Public without authentication.
- [x] Linked from public header and Settings.
- [ ] Legal review before store submission.

## 8. Payments

Current product has no in-app billing SDK or paid digital entitlement. Coupon-sale records are recordkeeping, not payment processing.

- [x] Mark release as free/no in-app purchases unless product scope changes.
- [ ] If paid digital features are added, stop release and implement StoreKit/Google Play Billing plus restore-purchases and production sandbox tests.

## 9. Backend security

- [x] JWT-derived identity.
- [x] RLS and blocked direct writes for sensitive tables.
- [x] Coupon secrets encrypted at rest.
- [x] Sensitive analytics fields scrubbed.
- [x] IP/activity retention jobs.
- [ ] Run all non-email server E2E against release project.
- [ ] Review Supabase Security Advisor immediately before submission.
- [ ] Confirm production secrets and encryption-key rotation record.

## 10. Analytics and support

- [x] Screen/action analytics with sensitive-field allowlist.
- [x] In-app issue report.
- [x] Public support route and support email.
- [ ] Verify support report delivery from production build.
- [ ] Verify analytics on a throwaway account, then delete that account.
- [ ] Add store-dashboard support URL and contact details.

## Release sign-off

Release may ship only when every unchecked item is either completed or explicitly accepted in a dated release note by the release owner.
