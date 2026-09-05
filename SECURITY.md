# Security Policy

## Supported version

Only the current `main` branch receives security fixes.

## Reporting a vulnerability

Do not open a public issue for vulnerabilities or exposed credentials. Use
GitHub's private vulnerability reporting feature in the repository Security
tab. Include affected files, reproduction steps, impact, and a suggested fix
when available.

Expect an acknowledgement within seven days. No bounty is currently offered.

### EU Cyber Resilience Act (Regulation (EU) 2024/2847)

The reporting channel above doubles as the coordinated vulnerability
disclosure channel required by the CRA (mandatory 2026-09-11). Commitments
beyond the seven-day acknowledgement:

- Vulnerabilities are triaged on receipt and receive a fix in the next
  release; actively exploited issues are patched as an emergency release.
- If a fixed vulnerability affects the hosted production deployment, users
  are notified through the in-app issue/report channel and the public
  support page (`https://coupons.itaykarkason.com/issues`), including the
  CVE or identifier once one is assigned, per the CRA's staged reporting
  timeline (ENISA/CSIRT notification for actively exploited issues within
  24 hours, users without undue delay after a fix is available).
- Release notes list security fixes after affected users have had a
  reasonable window to update.

This app ships no connected hardware products, so the CRA's user-facing
security-update support period is met by supporting the current `main`
release line (see Supported version above).

## Public client configuration

Supabase anon keys and all `EXPO_PUBLIC_*` values are bundled into the app.
They must never include service-role keys, provider API keys, passwords, or
other secrets. Database access must remain protected by RLS.

Coupon encryption keys are server-side secrets and are not bundled in the
client. This is encryption at rest, not end-to-end encryption: authenticated
server functions decrypt coupon fields when the product needs to show or use
them. The device may keep a decrypted offline wallet cache for up to 30 days;
sign-out and account deletion clear it.
