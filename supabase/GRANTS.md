# Explicit Data API access

Supabase project: `dugjsiyenazpsoiyduuz`.

Each migration creating a public table declares RLS and access decisions for
anon, authenticated, and service_role. `npm test` checks this rule in CI.
The forward grants migration preserves existing table privileges for all 40
current public tables. Column allowlists on users and coupon remain intact.

Three historical filenames were aligned with their deployed versions after
comparing their SQL, ignoring comments and whitespace. No old data migration
was rerun and no remote migration history was repaired.

The existing DATABASE_URL uses SQLAlchemy's postgresql+psycopg2 scheme.
Supabase CLI requires postgresql instead; normalize only the scheme when using
that URL for db push. Use the session pooler port (5432), not the transaction
pooler port (6543), for migration CLI connections. The local management token did not authenticate during
this change; deployment used the verified database connection.

Validation used isolated PostgreSQL databases without automatic table grants,
including column allowlist checks and repeated application of the forward
migration. A full db reset was not run: this migration history starts with
ALTER statements against a pre-existing legacy base schema, so it is not a
standalone definition of the entire database.
