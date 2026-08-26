#!/usr/bin/env bash
#
# Concurrency regression tests for the atomic write paths.
#
# These races cannot be reproduced by running the app twice by hand, and they
# cannot be tested from vitest either: they only exist between two database
# sessions. So the test forces the interleaving directly — N psql processes
# calling the same function at the same moment — and asserts the invariant
# that the old client-side read-modify-write broke.
#
# It writes to whatever database you point it at, so it refuses anything that
# is not local. Bring one up with the project schema:
#
#   supabase db dump --db-url "$SESSION_POOLER_URL" -f baseline.sql
#   # baseline.sql as the first migration, then this repo's newer ones
#   supabase start
#   ./supabase/tests/concurrency.sh
#
# Usage: PGURL=postgresql://postgres:postgres@127.0.0.1:54322/postgres ./concurrency.sh

set -euo pipefail

PGURL="${PGURL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

case "$PGURL" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "refusing to run against a non-local database: $PGURL" >&2; exit 1 ;;
esac

USER_ID=9001
AUTH_UID=11111111-1111-1111-1111-111111111111
COUPON_A=9001
COUPON_B=9002
JWT="set role authenticated; select set_config('request.jwt.claims','{\"sub\":\"$AUTH_UID\",\"role\":\"authenticated\"}',false);"

fail=0
check() { # check <label> <actual> <expected>
  if [ "$(echo "$2" | tr -d ' ')" = "$(echo "$3" | tr -d ' ')" ]; then
    echo "  ok   $1"
  else
    echo "  FAIL $1: expected '$3', got '$2'"; fail=1
  fi
}
q() { psql "$PGURL" -tA -c "$1"; }
auth() { psql "$PGURL" -tA -c "$JWT $1"; }

echo "seeding"
psql "$PGURL" -q -v ON_ERROR_STOP=1 <<SQL
delete from public.coupon_usage where coupon_id in ($COUPON_A, $COUPON_B);
delete from public.coupon_alerts where coupon_id in ($COUPON_A, $COUPON_B);
delete from public.coupon_tags where coupon_id in ($COUPON_A, $COUPON_B);
delete from public.coupon where id in ($COUPON_A, $COUPON_B);
delete from public.users where id = $USER_ID;
delete from auth.users where id = '$AUTH_UID';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('$AUTH_UID', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'race@test.local', 'x', now(), now(), now());

insert into public.users (id, email, password, first_name, last_name, is_deleted, auth_user_id, is_admin)
values ($USER_ID, 'race@test.local', 'x', 'Race', 'Test', false, '$AUTH_UID', false);

insert into public.coupon (id, code, value, cost, company, used_value, status, user_id, auto_update)
values ($COUPON_A, 'RACE-A', 100, 100, 'Test', 0, 'פעיל', $USER_ID, false),
       ($COUPON_B, 'RACE-B', 100, 100, 'Test', 0, 'פעיל', $USER_ID, false);
SQL

echo
echo "record_coupon_usage: 10 concurrent usages of 5 must all land"
for _ in $(seq 1 10); do
  auth "select * from public.record_coupon_usage($COUPON_A, 5);" >/dev/null &
done
wait
check "coupon.used_value"      "$(q "select used_value from coupon where id=$COUPON_A;")" "50"
check "ledger sum"             "$(q "select coalesce(sum(used_amount),0) from coupon_usage where coupon_id=$COUPON_A;")" "50"
check "ledger rows"            "$(q "select count(*) from coupon_usage where coupon_id=$COUPON_A;")" "10"

echo
echo "record_coupon_usage: contract"
check "caps at coupon value"   "$(auth "select new_used from public.record_coupon_usage($COUPON_A, 999);" | tail -1)" "100"
check "status when exhausted"  "$(q "select status from coupon where id=$COUPON_A;")" "נוצל"
# The column is `timestamp without time zone` and the client has always sent
# new Date().toISOString(), so UTC is what it holds. Moving the insert into the
# function must not shift it into the server's zone.
auth "select 1 from public.record_coupon_usage($COUPON_B, 1, null, 'probe', null, null, null, '2026-01-02T03:04:05.000Z');" >/dev/null
check "timestamp stored as UTC" \
  "$(q "select timestamp from coupon_usage where place_name='probe';")" "2026-01-02 03:04:05"
check "rejects another user's coupon" \
  "$(auth "select * from public.record_coupon_usage(-1, 5);" 2>&1 | grep -c COUPON_NOT_FOUND)" "1"
check "rejects anonymous caller" \
  "$(psql "$PGURL" -tA -c "set role authenticated; select * from public.record_coupon_usage($COUPON_A, 5);" 2>&1 | grep -c NOT_AUTHENTICATED)" "1"
check "rejects zero amount" \
  "$(auth "select * from public.record_coupon_usage($COUPON_A, 0);" 2>&1 | grep -c INVALID_AMOUNT)" "1"

echo
echo "set_coupon_tags: concurrent writers must not duplicate tags or drift count"
for _ in $(seq 1 8); do
  auth "select public.set_coupon_tags($COUPON_A, array['alpha','beta']);" >/dev/null &
  auth "select public.set_coupon_tags($COUPON_B, array['alpha']);" >/dev/null &
done
wait
check "no duplicate tag names" "$(q "select count(*) from (select name from tag group by name having count(*)>1) d;")" "0"
check "alpha linked twice"     "$(q "select count from tag where name='alpha';")" "2"
check "beta linked once"       "$(q "select count from tag where name='beta';")" "1"
check "no count drift anywhere" \
  "$(q "select count(*) from tag t where t.count <> (select count(*) from coupon_tags ct where ct.tag_id=t.id);")" "0"

auth "select public.set_coupon_tags($COUPON_A, array['beta','  gamma  ','']);" >/dev/null
check "dropped tag unlinked"   "$(q "select count(*) from coupon_tags ct join tag t on t.id=ct.tag_id where ct.coupon_id=$COUPON_A and t.name='alpha';")" "0"
check "whitespace name trimmed" "$(q "select count(*) from tag where name='gamma';")" "1"
check "empty name skipped"     "$(q "select count(*) from tag where name='';")" "0"

echo
echo "coupon_alerts: only one concurrent claim may win"
q "delete from coupon_alerts where coupon_id=$COUPON_A;" >/dev/null
claims=$(mktemp)
for _ in $(seq 1 6); do
  q "insert into coupon_alerts (coupon_id,user_id,window_days,channel,status)
     values ($COUPON_A,$USER_ID,7,'email','pending')
     on conflict (coupon_id,window_days,channel) do nothing
     returning coupon_id;" >>"$claims" 2>&1 &
done
wait
check "exactly one claim"      "$(grep -c "^$COUPON_A$" "$claims")" "1"
check "one ledger row"         "$(q "select count(*) from coupon_alerts where coupon_id=$COUPON_A;")" "1"
rm -f "$claims"

echo
echo "coupon_places: signed-in users may read but not write"
check "insert denied"          "$(auth "insert into coupon_places (normalized_name, place_name) values ('hack','hack');" 2>&1 | grep -c 'permission denied')" "1"
check "update denied"          "$(auth "update coupon_places set place_address='x';" 2>&1 | grep -c 'permission denied')" "1"
check "select allowed"         "$(auth "select count(*) >= 0 from coupon_places;" | tail -1)" "t"

echo
if [ "$fail" -eq 0 ]; then echo "all concurrency tests passed"; else echo "FAILURES"; exit 1; fi
