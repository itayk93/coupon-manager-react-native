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
- Biometric lock, push and email notifications
- Referral chains behind an admin-only dashboard (`supabase/migrations/*_referral_*.sql`)

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

To build a standalone Release APK, install it on a connected Android device and
launch it:

```bash
npm run build:android:device
```

Enable USB debugging on the device and approve the computer when prompted. Use
`npm run build:android:device -- --clean` to force a clean native rebuild.

`npm start` alone expects a dev client. The app uses native modules, so Expo Go
will not run it — build once with `npm run ios` / `npm run android` first.

### Live iPhone logs

Connect and unlock the iPhone, then run:

```bash
npm run logs:ios
```

This detects the connected iPhone and streams JavaScript logs, warnings, native
errors and crashes from `CouponMaster`. Press `Ctrl-C` to stop.

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

### Referrals

A partner gets a code; whoever registers through it is attributed to their
campaign, and so is whoever registers through *that* person's code, however
deep the chain runs. It is a closed programme rather than a feature for
everyone: a personal code only exists once the server has attributed someone to
a campaign, so there is no flag to remember to turn off.

Partners are created from the admin screen by picking an existing account —
the arrangement always starts with someone already using the app, and a name in
a text column joins to nothing. The code is generated and cannot be chosen: a
link that spells out whose it is gets guessed and forwarded with the name
attached. Every partner is on the same ladder, so there is nothing per-deal to
edit; what differs is the tally, and ten simultaneous partners are ten rows
rather than ten migrations. Ending one deactivates the code — it stops
attributing anyone new while everyone already counted stays counted.

- Attribution is written once. A unique key on `referred_user_id` is the lock,
  and a trigger freezes the columns that decide who gets paid, so a link cannot
  move a paying user between partners after the fact.
- Qualification is computed from `coupon` and `user_activities` — a real coupon
  plus coupon activity on three separate days in the first month to activate,
  two separate days in the second to count as retained. Opening the app and
  logging in count for nothing. `pg_cron` runs
  `refresh_referral_progress()` hourly; retention lands the day it is earned
  rather than waiting for day 60.
- Nothing pays out on its own. Crossing a threshold stamps `earned_at`;
  `paid_at` is written by hand from the admin screen once the reward has
  actually gone out.
- The tally is admin-only. `my_referral_status()` returns a single column — the
  code — and every referral table sits behind `is_app_admin()`. A partner can
  share their link and cannot watch the number they are paid on.

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

Two suites run against a real deployment rather than a mock, because what they
check — that the server, not the client, decides whose account a row belongs to
— cannot be observed from unit tests. They create throwaway accounts and delete
everything they made:

```bash
set -a && . ./.env.supabase.local && set +a
npm run e2e:activity-log
npm run e2e:referral
```

## License

Copyright © 2026 Itay Karkason. All rights reserved. Viewing this public
repository does not grant permission to use, copy, modify, distribute, or sell
the code. See [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contributions require explicit written
approval and do not change the proprietary license.
