# Contributing

## Setup

1. Install Node.js 22.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and use a non-production Supabase project.
4. Build a development client with `npm run ios` or `npm run android`.

Expo Go is not supported because the app contains native modules.

## Quality checks

Run these before committing:

```bash
npm test
npm run typecheck
```

Keep changes focused. Add tests for security-sensitive logic and bug fixes.
Never commit credentials, local database dumps, generated build output, or
real coupon data.

## Issues

Search existing issues first. Include reproduction steps, expected behavior,
actual behavior, platform, OS version, and app version. Report security issues
privately according to `SECURITY.md`.
