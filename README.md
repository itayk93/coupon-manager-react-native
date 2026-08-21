# Coupon Master

[![CI](https://github.com/itayk93/coupon-manager-react-native/actions/workflows/ci.yml/badge.svg)](https://github.com/itayk93/coupon-manager-react-native/actions/workflows/ci.yml)
[![License: All Rights Reserved](https://img.shields.io/badge/License-All%20Rights%20Reserved-red.svg)](LICENSE)

![Coupon Master social preview](public/social-preview.png)

Expo / React Native app for tracking gift cards and prepaid coupons: what you own,
how much is left on each, and when it expires. Hebrew-first, RTL throughout.
Backed by Supabase (Postgres + Auth + Edge Functions).

## Features

- Coupon vault with per-coupon balance, usage history and expiry tracking
- Coupon-code encryption compatible with the server-side Fernet format
- Camera scanning + AI parsing of coupon screenshots (`supabase/functions/parse-coupon`)
- Automatic balance refresh for supported providers (Multipass)
- Home-screen widgets on iOS and Android (`modules/coupon-widget`, `targets/`)
- Biometric lock, push and email notifications, marketplace for reselling coupons

## Screenshot

<img src="public/screenshots/login.png" alt="Coupon Master login screen in Hebrew" width="320" />

## Stack

| Layer | Choice |
|---|---|
| App | Expo SDK 57, React Native, expo-router |
| Data | `@tanstack/react-query` over `@supabase/supabase-js` |
| Backend | Supabase Postgres with RLS, Deno Edge Functions |
| Native | Custom Expo module for widgets (Kotlin + Swift) |
| Tests | vitest, `tsc --noEmit` |

## Getting started

Requires Node 22, and Xcode or Android Studio for a native build.

```bash
npm install
cp .env.example .env   # fill in your own Supabase project
npm run ios            # or: npm run android
```

Use a separate Supabase project for local development. Never reuse production
credentials or production coupon data.

`npm start` alone expects a dev client. The app uses native modules, so Expo Go
will not run it — build once with `npm run ios` / `npm run android` first.

## Backend

Migrations live in `supabase/migrations/`, applied in filename order:

```bash
supabase db push
supabase functions deploy
supabase secrets set --env-file supabase/functions/.env
```

See `supabase/functions/.env.example` for the secrets each function needs, and
`supabase/DEPLOYMENT.md` for the deploy details.

### Security model

There is no application server. All authorization is enforced in the database:

- Every table in `public` has RLS enabled. Policies scope rows to the calling
  user via `app_user_id()`, with an admin escape hatch via `is_app_admin()`
  (`0010_auth_foundation.sql`, `0011_lock_down_rls.sql`).
- The RPC surface is revoked down to `service_role`; `anon` can execute nothing
  (`0016_revoke_public_rpc_execute.sql`).
- The anon key is public by design — it grants no data access on its own.

### Coupon encryption

Sensitive coupon fields are encrypted and decrypted only by the authenticated
`coupon-vault` Edge Function. Encryption keys stay in Supabase secrets and are
never bundled into the web or mobile application.

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Tests

```bash
npm test
npm run typecheck
```

## License

Copyright © 2026 Itay Karkason. All rights reserved. Viewing this public
repository does not grant permission to use, copy, modify, distribute, or sell
the code. See [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contributions require explicit written
approval and do not change the proprietary license.
