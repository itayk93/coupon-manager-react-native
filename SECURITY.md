# Security Policy

## Supported version

Only the current `main` branch receives security fixes.

## Reporting a vulnerability

Do not open a public issue for vulnerabilities or exposed credentials. Use
GitHub's private vulnerability reporting feature in the repository Security
tab. Include affected files, reproduction steps, impact, and a suggested fix
when available.

Expect an acknowledgement within seven days. No bounty is currently offered.

## Public client configuration

Supabase anon keys and all `EXPO_PUBLIC_*` values are bundled into the app.
They must never include service-role keys, provider API keys, passwords, or
other secrets. Database access must remain protected by RLS.

The current coupon encryption key is client-visible and is not an end-to-end
encryption boundary. See the limitation documented in `README.md`.
