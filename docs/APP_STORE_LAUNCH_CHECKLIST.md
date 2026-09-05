# App Store launch checklist

Updated: 2026-09-05

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

Review notes must explain scanner permission, location permission, notification permission, account deletion path, the OTA mechanism, and any feature unavailable without a physical device.

OTA disclosure to paste into the review notes (Apple 3.3.2 / 2.5.2):

> This app uses Expo Updates (expo-updates) to deliver over-the-air
> JavaScript bug fixes and performance improvements between app releases.
> OTA updates never change the app's purpose, add features, or alter the UI
> beyond what was reviewed.

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
- Location: optional precise foreground-only device location for user-triggered map features. Background location was removed from the app on 2026-09-05 (unused permission; see `compliance-audit/REMEDIATION-2026-09-05.md` §1.1).
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

## 11. Platform compliance items (from 2026-09-05 audit)

Full findings and code fixes: `compliance-audit/REMEDIATION-2026-09-05.md`. Items below are the console-side actions that source code cannot prove.

### App Store Connect

- [ ] Answer the 2026 age-rating questionnaire (13+/16+/18+ categories; the app has no gambling, user-generated content, or age-restricted content).
- [ ] Complete App Privacy (Nutrition Labels) per §6 and `ios/CouponMaster/PrivacyInfo.xcprivacy` — email, user ID, user content, coarse location; all linked to identity, all app functionality, no tracking.
- [ ] Confirm `ITSAppUsesNonExemptEncryption = false` was picked up from the archive (export compliance no longer blocks in "Missing Compliance").
- [ ] Accept any pending Developer Program License Agreement.
- [ ] Verify Sign in with Apple end-to-end in a release build (guideline 4.8): Apple button on the login screen is implemented in the app; the Supabase Apple provider must be enabled on the hosted project (Authentication → Providers → Apple, Services ID `com.itaykarkason.couponmaster`, callback `https://dugjsiyenazpsoiyduuz.supabase.co/auth/v1/callback`). Local-dev template lives commented in `supabase/config.toml`.
- [ ] Verify the share extensions (VoiceOver labels, Increase Contrast) in the TestFlight build.

### Google Play Console

- [ ] Confirm the uploaded AAB reports `targetSdk 36` (verified in source: react-native `gradle/libs.versions.toml` pins compile/target 36; the 31.8.2026 deadline is met on the next build).
- [ ] Complete the Data Safety form per §6 (background location is no longer declared anywhere in the app).
- [ ] Supply the account deletion URL/path (uses the in-app deletion + `coupons.itaykarkason.com` web route).
- [ ] Closed testing: 12 testers over 14 consecutive days if the Play account is a new personal account.
- [ ] Android Developer Verification: register and verify developer identity before 2026-09-30 (required for Brazil, Indonesia, Singapore, Thailand installs).
- [ ] Confirm no Play Billing migration is needed — the app ships no billing SDK (Play Billing 8 deadline is not applicable).
