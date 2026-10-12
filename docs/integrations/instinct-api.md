# Instinct read API

Admin UI: `/admin?tab=instinct`. Currently only application user **1**, with an active administrator flag, may manage keys or be their data subject. Other administrators are denied too. No arbitrary user selection is available during this pilot.

The UI requires explicit consent to decrypted data disclosure, then creates a 256-bit random key shown once. Choose 7, 30 (default), or 90 days. Download the Hebrew Markdown guide in the UI and give the key separately to Instinct. Revocation stops subsequent reads immediately; it cannot erase information already retrieved by the external assistant.

## Security contract

- Management: verified Supabase JWT, primary admin identity, AAL2 MFA, live Auth session. The session checker is a service-only RPC with a private narrowly granted helper; Auth tables remain inaccessible to `service_role`.
- Database constraints pin both owner and issuer to user 1 and require versioned consent. Every external read rechecks owner existence, deletion status, administrator status, consent, expiry, revocation and per-key rate limit.
- Raw keys never persist in the database. SHA-256 digests, a short identifying prefix, creation/consent/expiry/revocation/last-use timestamps are retained. User-facing roles have no table or RPC grants.
- Fixed private views expose the approved columns, scoped by ownership before filtering, pagination or aggregation. Coupon child rows are joined through owned coupons. Shared coupons owned by other users are excluded.
- Read-only external HTTP interface. No SQL, write endpoint, auth credentials, encryption key or service credential is exposed. SQL identifiers are allowlisted; values are quoted, and all sort directions/operators are closed enums.
- Coupon secrets are decrypted only after successful authorization, using the same Fernet/HMAC validation and key rotation implementation as `coupon-vault`. Database ciphertext remains unchanged. Decryption failures fail the entire request instead of returning ciphertext or silently omitting a field.
- Decrypted coupon columns can be selected, but filtering/ordering on them returns 400 because database queries run against ciphertext. Clients can page through results and search decrypted fields locally.
- HTTP responses carry `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Auth headers are preferred. Query-string keys are supported for Instinct compatibility; URLs containing keys must be treated as secrets and may appear in upstream platform request logs. Never log full request URLs or response bodies.
- 120 requests/minute/key, 200 rows/page, 20 filters, 5 sort columns, bounded offsets, 8-second DB statement timeout. Counts are correct for empty pages. Ordering has deterministic tie-breakers.

## Resources

`schema`, `summary`, `coupon`, `coupon_usage`, `coupon_transaction`, `coupon_tags`, `companies`, `users`, `coupon_alerts`, `notification_preferences`.

`summary` covers all non-deleted owned coupons, including expired/inactive ones. It is not a claim about spendable funds. `coupon.remaining_value = value - used_value`; use status and expiration filters to select available coupons. Usage and provider transactions are separate sources and must not be blindly summed together.

## Deployment

Migrations:
- `20261012123336_instinct_user_api.sql`
- `20261012124328_instinct_session_guard.sql`
- `20261012125353_instinct_live_mfa_guard.sql`

Functions:
- `instinct-api`: `verify_jwt = false`, own API-key validation.
- `manage-instinct-keys`: `verify_jwt = true`, explicit primary-admin/MFA/session checks.

Uses existing Supabase runtime credentials and `ENCRYPTION_KEY` / optional `ENCRYPTION_KEY_PREVIOUS`. No new client secrets.

The project's remote migration history already has three entries missing locally (`20260912073620`, `20261004171819`, `20261007071739`). This feature was applied with Supabase CLI against an isolated copy of the existing remote migration history plus these new migrations. Earlier migration history was not repaired or changed.

## Verification

`npm run typecheck`

`npm test`

`deno check supabase/functions/instinct-api/index.ts supabase/functions/manage-instinct-keys/index.ts`

After sourcing `.env.supabase.local`, `node scripts/e2e-instinct-api.mjs` exercises the deployed functions and database. It creates a disposable test account, an encrypted fixture coupon, an owned copy and an in-memory test key; removes all fixtures in `finally`; never prints real account data or credentials. Checks include other-user/admin rejection, foreign-row and child-row isolation, exact decryption of known test plaintext, pagination, private columns, SQL injection, read-only methods, expiry, revocation, rate limiting and direct REST/RPC denial.

`PLAYWRIGHT_MODULE=/path/to/playwright node scripts/e2e-instinct-ui.cjs` runs against the Expo web export in `/tmp/coupon-instinct-web` (override with `INSTINCT_WEB_BUILD_DIR`). Browser UI tests cover consent, fixed account, creation, connection check, guide download, hiding the secret and revocation at desktop/mobile widths. Mocked UI verification is separate from live API verification; production MFA must be completed by the account owner.
