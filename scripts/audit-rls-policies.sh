#!/usr/bin/env bash
#
# Fails if the database contains an RLS policy that grants blanket access, or a
# table with no protection at all. This is the check that would have caught the
# *_anon_ios policies on the day they were added.
#
# Reads DATABASE_URL from .env.supabase.local (SQLAlchemy-style URLs are
# normalised for psql).
#
#   ./scripts/audit-rls-policies.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env.supabase.local ]]; then
  set -a; . ./.env.supabase.local; set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set (expected in .env.supabase.local)" >&2
  exit 2
fi

PGURL="$(sed 's|postgresql+psycopg2://|postgresql://|' <<< "$DATABASE_URL")"
failures=0

echo "==> Policies granting unconditional access to anon"
open_policies=$(psql "$PGURL" -tA -F'|' <<'SQL'
select tablename || ' :: ' || policyname || ' (' || cmd || ' to ' || roles::text || ')'
from pg_policies
where schemaname = 'public'
  and coalesce(qual, 'true') = 'true'
  and coalesce(with_check, 'true') = 'true'
  and roles::text like '%anon%'
order by tablename, policyname;
SQL
)

if [[ -n "$open_policies" ]]; then
  echo "$open_policies" | sed 's/^/    FAIL  /'
  failures=$(( failures + $(wc -l <<< "$open_policies") ))
else
  echo "    ok"
fi

echo
echo "==> Tables without row level security"
no_rls=$(psql "$PGURL" -tA <<'SQL'
select c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
  and c.relname <> 'alembic_version'
order by c.relname;
SQL
)

if [[ -n "$no_rls" ]]; then
  echo "$no_rls" | sed 's/^/    FAIL  /'
  failures=$(( failures + $(wc -l <<< "$no_rls") ))
else
  echo "    ok"
fi

echo
echo "==> Policies comparing auth.uid() to an integer column"
# auth.uid() is a uuid. ((auth.uid())::text)::integer always raises, so any
# policy written this way silently grants nothing and hides a real bug.
bad_cast=$(psql "$PGURL" -tA -F'|' <<'SQL'
select tablename || ' :: ' || policyname
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') like '%(auth.uid())::text)::integer%'
    or coalesce(with_check, '') like '%(auth.uid())::text)::integer%')
order by tablename, policyname;
SQL
)

if [[ -n "$bad_cast" ]]; then
  echo "$bad_cast" | sed 's/^/    FAIL  /'
  failures=$(( failures + $(wc -l <<< "$bad_cast") ))
else
  echo "    ok"
fi

echo
if (( failures > 0 )); then
  echo "$failures problem(s) found."
  exit 1
fi

echo "RLS audit passed."
