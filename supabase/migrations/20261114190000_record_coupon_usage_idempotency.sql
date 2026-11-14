-- Idempotency for the single-usage path (UX detail: idempotency keys).
--
-- record_coupon_usage_batch has always required p_import_key and replays
-- safely (20260829170000). The single-usage RPC did not: a retried or
-- double-submitted call inserted a second ledger row. This adds the same
-- protection here. The import key is optional so older clients keep working;
-- when present, a replay returns the current coupon state without inserting.
--
-- APPLY ORDER: this migration must run in production BEFORE any app build
-- that sends p_import_key is released, or those calls will fail.
--
-- It also hardens record_coupon_usage_batch against the same race: the
-- import row used to be written AFTER the usage rows, so two concurrent
-- same-key calls could both pass the replay check and both insert. Both
-- functions now claim the key under the coupon row lock, before touching
-- the ledger.

drop function if exists public.record_coupon_usage(
  integer, double precision, text, text, text, double precision, double precision, text
);

create or replace function public.record_coupon_usage(
  p_coupon_id     integer,
  p_used_amount   double precision,
  p_details       text default null,
  p_place_name    text default null,
  p_place_address text default null,
  p_latitude      double precision default null,
  p_longitude     double precision default null,
  p_timestamp     text default null,
  p_import_key    text default null
)
returns table (new_used double precision, fully_used boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user  integer;
  v_value double precision;
  v_used  double precision;
  v_new   double precision;
  v_existing public.coupon_usage_imports%rowtype;
  v_import_id bigint;
begin
  v_user := public.app_user_id();
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if p_used_amount is null or p_used_amount <= 0 or p_used_amount = 'NaN'::double precision then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  -- Replay short-circuit: this key already recorded a usage for this user.
  -- Mirrors record_coupon_usage_batch: return the current state, insert nothing.
  if p_import_key is not null and length(btrim(p_import_key)) >= 8 then
    select * into v_existing from public.coupon_usage_imports
    where user_id = v_user and import_key = p_import_key;
    if found then
      select coalesce(c.used_value, 0), c.value into v_used, v_value
        from public.coupon c where c.id = v_existing.coupon_id;
      return query select v_used, v_used >= v_value;
      return;
    end if;
  end if;

  -- FOR UPDATE is the whole point: a second caller waits here instead of
  -- reading the same pre-update balance.
  select c.value, coalesce(c.used_value, 0)
    into v_value, v_used
    from public.coupon c
   where c.id = p_coupon_id
     and c.user_id = v_user
   for update;

  if not found then
    raise exception 'COUPON_NOT_FOUND' using errcode = '42501';
  end if;

  -- Claim the key under the lock, BEFORE the ledger insert. A concurrent
  -- call with the same key that raced past the pre-lock check was blocked
  -- on the lock; it finds the row here and short-circuits instead of
  -- inserting a second usage. Rollback frees the key if anything later fails.
  if p_import_key is not null and length(btrim(p_import_key)) >= 8 then
    insert into public.coupon_usage_imports (user_id, import_key, coupon_id, usage_count, total_amount)
    values (v_user, p_import_key, p_coupon_id, 1, p_used_amount)
    on conflict (user_id, import_key) do nothing
    returning id into v_import_id;
    if v_import_id is null then
      return query select v_used, v_used >= v_value;
      return;
    end if;
  end if;

  v_new := least(v_value, v_used + p_used_amount);

  insert into public.coupon_usage (
    coupon_id, used_amount, action, details,
    place_name, place_address, latitude, longitude, timestamp
  ) values (
    p_coupon_id,
    p_used_amount,
    'usage',
    nullif(btrim(coalesce(p_details, '')), ''),
    nullif(btrim(coalesce(p_place_name, '')), ''),
    nullif(btrim(coalesce(p_place_address, '')), ''),
    p_latitude,
    p_longitude,
    -- The client used to send new Date().toISOString(); the column is
    -- `timestamp without time zone`, so UTC is what it has always stored.
    coalesce(nullif(p_timestamp, '')::timestamptz at time zone 'utc', now() at time zone 'utc')
  );

  update public.coupon
     set used_value = v_new,
         status = case when v_new >= v_value then 'נוצל' else 'פעיל' end
   where id = p_coupon_id;

  return query select v_new, v_new >= v_value;
end;
$$;

revoke execute on function public.record_coupon_usage(
  integer, double precision, text, text, text, double precision, double precision, text, text
) from public, anon;

grant execute on function public.record_coupon_usage(
  integer, double precision, text, text, text, double precision, double precision, text, text
) to authenticated;

-- Replay check, for whoever applies this (run in the SQL editor as a normal
-- user, twice with the same key): the second call must return the same
-- new_used and add no row to coupon_usage or coupon_usage_imports.
--   select * from public.record_coupon_usage(843, 1, 'replay-test', null, null, null, null, null, 'replay-test-key-0001');
--   select * from public.record_coupon_usage(843, 1, 'replay-test', null, null, null, null, null, 'replay-test-key-0001');

-- record_coupon_usage_batch: same race, same fix. Identical to
-- 20260829170000 except the import row is claimed under the coupon lock,
-- before the usage rows, with on conflict do nothing; a concurrent replay
-- short-circuits on the claimed key instead of double-inserting.

create or replace function public.record_coupon_usage_batch(
  p_coupon_id integer,
  p_usages jsonb,
  p_import_key text
)
returns table (new_used double precision, fully_used boolean, inserted_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user integer;
  v_value double precision;
  v_used double precision;
  v_total double precision;
  v_count integer;
  v_existing public.coupon_usage_imports%rowtype;
  v_import_id bigint;
begin
  v_user := public.app_user_id();
  if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_import_key is null or length(btrim(p_import_key)) < 8 then
    raise exception 'INVALID_IMPORT_KEY' using errcode = '22023';
  end if;

  select * into v_existing from public.coupon_usage_imports
  where user_id = v_user and import_key = p_import_key;
  if found then
    select coalesce(c.used_value, 0), c.value into v_used, v_value from public.coupon c where c.id = v_existing.coupon_id;
    return query select v_used, v_used >= v_value, v_existing.usage_count;
    return;
  end if;

  if jsonb_typeof(p_usages) <> 'array' or jsonb_array_length(p_usages) = 0 or jsonb_array_length(p_usages) > 50 then
    raise exception 'INVALID_USAGES' using errcode = '22023';
  end if;

  select c.value, coalesce(c.used_value, 0) into v_value, v_used
  from public.coupon c
  where c.id = p_coupon_id and c.user_id = v_user
  for update;
  if not found then raise exception 'COUPON_NOT_FOUND' using errcode = '42501'; end if;

  select count(*), sum(x.amount) into v_count, v_total
  from jsonb_to_recordset(p_usages) as x(amount double precision);
  if v_count = 0 or v_total is null or v_total <= 0 or exists (
    select 1 from jsonb_to_recordset(p_usages) as x(amount double precision)
    where x.amount is null or x.amount <= 0 or x.amount = 'NaN'::double precision
  ) then raise exception 'INVALID_AMOUNT' using errcode = '22023'; end if;
  if v_used + v_total > v_value then raise exception 'INSUFFICIENT_BALANCE' using errcode = '22023'; end if;

  -- Claim the key under the lock, BEFORE the usage rows (see above).
  insert into public.coupon_usage_imports(user_id, import_key, coupon_id, usage_count, total_amount)
  values (v_user, p_import_key, p_coupon_id, v_count, v_total)
  on conflict (user_id, import_key) do nothing
  returning id into v_import_id;
  if v_import_id is null then
    select * into v_existing from public.coupon_usage_imports
    where user_id = v_user and import_key = p_import_key;
    return query select v_used, v_used >= v_value, coalesce(v_existing.usage_count, 0);
    return;
  end if;

  insert into public.coupon_usage (
    coupon_id, used_amount, action, details, place_name, place_address, latitude, longitude, timestamp
  )
  select p_coupon_id, x.amount, 'usage', nullif(btrim(coalesce(x.details, '')), ''),
    nullif(btrim(coalesce(x.place_name, '')), ''), nullif(btrim(coalesce(x.place_address, '')), ''),
    x.latitude, x.longitude,
    coalesce(nullif(x.used_at, '')::timestamptz at time zone 'utc', now() at time zone 'utc')
  from jsonb_to_recordset(p_usages) as x(
    amount double precision, details text, place_name text, place_address text,
    latitude double precision, longitude double precision, used_at text
  );

  v_used := v_used + v_total;
  update public.coupon set used_value = v_used,
    status = case when v_used >= v_value then 'נוצל' else 'פעיל' end
  where id = p_coupon_id;

  return query select v_used, v_used >= v_value, v_count;
end;
$$;

revoke execute on function public.record_coupon_usage_batch(integer, jsonb, text) from public, anon;
grant execute on function public.record_coupon_usage_batch(integer, jsonb, text) to authenticated;
