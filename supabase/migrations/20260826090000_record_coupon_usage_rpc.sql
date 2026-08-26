-- Record a coupon usage atomically.
--
-- useRecordUsage did this as three round trips from the client: read
-- used_value, insert the ledger row, write used_value back. Two usages racing
-- each other both read the same starting balance and the second write wins, so
-- the ledger holds both amounts while the coupon shows only one of them.
--
-- One function, one transaction, and the coupon row locked before it is read.
-- Ownership is checked here rather than trusted from the caller: the function
-- is SECURITY DEFINER, so it must not take the user id as an argument.

create or replace function public.record_coupon_usage(
  p_coupon_id     integer,
  p_used_amount   double precision,
  p_details       text default null,
  p_place_name    text default null,
  p_place_address text default null,
  p_latitude      double precision default null,
  p_longitude     double precision default null,
  p_timestamp     text default null
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
begin
  v_user := public.app_user_id();
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if p_used_amount is null or p_used_amount <= 0 or p_used_amount = 'NaN'::double precision then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
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
  integer, double precision, text, text, text, double precision, double precision, text
) from public, anon;

grant execute on function public.record_coupon_usage(
  integer, double precision, text, text, text, double precision, double precision, text
) to authenticated;
