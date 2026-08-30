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
  where c.id = p_coupon_id
    and (
      c.user_id = v_user or exists (
        select 1 from public.coupon_shares s
        where s.coupon_id = c.id and s.shared_with_user_id = v_user
          and s.share_type = 'shared' and s.status = 'accepted'
          and s.share_expires_at > now()
      )
    )
  for update;
  if not found then raise exception 'COUPON_NOT_FOUND' using errcode = '42501'; end if;

  create temporary table tmp_coupon_usage_import on commit drop as
  select
    row_number() over () as source_row,
    x.amount,
    nullif(btrim(coalesce(x.details, '')), '') as details,
    nullif(btrim(coalesce(x.place_name, '')), '') as place_name,
    nullif(btrim(coalesce(x.place_address, '')), '') as place_address,
    x.latitude,
    x.longitude,
    coalesce(nullif(x.used_at, '')::timestamptz at time zone 'utc', now() at time zone 'utc') as used_at,
    lower(regexp_replace(btrim(coalesce(nullif(x.place_name, ''), nullif(x.place_address, ''), '')), '[[:space:][:punct:]]+', ' ', 'g')) as place_key
  from jsonb_to_recordset(p_usages) as x(
    amount double precision, details text, place_name text, place_address text,
    latitude double precision, longitude double precision, used_at text
  );

  if exists (
    select 1 from tmp_coupon_usage_import
    where amount is null or amount <= 0 or amount = 'NaN'::double precision
  ) then raise exception 'INVALID_AMOUNT' using errcode = '22023'; end if;

  delete from tmp_coupon_usage_import t
  using tmp_coupon_usage_import earlier
  where earlier.source_row < t.source_row
    and round((earlier.amount::numeric) * 100) = round((t.amount::numeric) * 100)
    and earlier.place_key = t.place_key
    and date_trunc('minute', earlier.used_at) = date_trunc('minute', t.used_at);

  delete from tmp_coupon_usage_import t
  where exists (
    select 1
    from public.coupon_usage u
    where u.coupon_id = p_coupon_id
      and round((coalesce(u.used_amount, 0)::numeric) * 100) = round((t.amount::numeric) * 100)
      and lower(regexp_replace(btrim(coalesce(nullif(u.place_name, ''), nullif(u.place_address, ''), '')), '[[:space:][:punct:]]+', ' ', 'g')) = t.place_key
      and date_trunc('minute', u.timestamp) = date_trunc('minute', t.used_at)
  );

  delete from tmp_coupon_usage_import t
  where exists (
    select 1
    from public.coupon_transaction tx
    where tx.coupon_id = p_coupon_id
      and round((coalesce(tx.usage_amount, 0)::numeric) * 100) = round((t.amount::numeric) * 100)
      and lower(regexp_replace(btrim(coalesce(nullif(tx.location, ''), '')), '[[:space:][:punct:]]+', ' ', 'g')) = t.place_key
      and date_trunc('minute', tx.transaction_date) = date_trunc('minute', t.used_at)
  );

  select count(*), coalesce(sum(amount), 0) into v_count, v_total
  from tmp_coupon_usage_import;

  if v_count = 0 then
    insert into public.coupon_usage_imports(user_id, import_key, coupon_id, usage_count, total_amount)
    values (v_user, p_import_key, p_coupon_id, 0, 0);
    return query select v_used, v_used >= v_value, 0;
    return;
  end if;

  if v_used + v_total > v_value then raise exception 'INSUFFICIENT_BALANCE' using errcode = '22023'; end if;

  insert into public.coupon_usage (
    coupon_id, used_amount, action, details, place_name, place_address, latitude, longitude, timestamp
  )
  select p_coupon_id, amount, 'usage', details, place_name, place_address, latitude, longitude, used_at
  from tmp_coupon_usage_import
  order by source_row;

  v_used := v_used + v_total;
  update public.coupon set used_value = v_used,
    status = case when v_used >= v_value then 'נוצל' else 'פעיל' end
  where id = p_coupon_id;

  insert into public.coupon_usage_imports(user_id, import_key, coupon_id, usage_count, total_amount)
  values (v_user, p_import_key, p_coupon_id, v_count, v_total);

  return query select v_used, v_used >= v_value, v_count;
end;
$$;

revoke execute on function public.record_coupon_usage_batch(integer, jsonb, text) from public, anon;
grant execute on function public.record_coupon_usage_batch(integer, jsonb, text) to authenticated;
