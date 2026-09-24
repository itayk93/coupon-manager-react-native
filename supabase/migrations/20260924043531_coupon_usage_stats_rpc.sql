-- Per-coupon usage counts and latest usage times, aggregated in the database.
--
-- useCouponUsageStats used to download every coupon_usage and
-- coupon_transaction row of the whole wallet just to count them and take the
-- latest date, and refetched all of it after every usage. It also read without
-- paging, so past PostgREST's 1000-row cap a busy wallet's counts silently
-- came out short. This returns one row per coupon instead.
--
-- SECURITY INVOKER on purpose: the caller's RLS on both ledger tables decides
-- what is counted, exactly as the direct selects it replaces did — owned
-- coupons, accepted shares, and nothing else.
--
-- The hidden-row rule mirrors isHiddenLedgerRow() in src/lib/couponLedger.ts:
-- the Multipass audit rows are left out, matched on the same text the client
-- uses (details, falling back to action; location, falling back to source).
-- The latest times are returned per table, in their own column types, so the
-- client parses them exactly as it parsed the raw rows before.

-- Same rule as isHiddenLedgerRow(): trimmed text, one of the two exact audit
-- strings, or either Multipass flow named anywhere in it (case-insensitive).
create or replace function public.is_hidden_ledger_row(p_details text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when btrim(coalesce(p_details, '')) = '' then false
    when btrim(p_details) in (
      'עדכון אוטומטי via Multipass daily flow',
      'עדכון אוטומטי via Multipass CI flow'
    ) then true
    else position('multipass daily flow' in lower(btrim(p_details))) > 0
      or position('multipass ci flow' in lower(btrim(p_details))) > 0
  end;
$$;

create or replace function public.coupon_usage_stats(p_coupon_ids integer[])
returns table (
  coupon_id integer,
  usage_count integer,
  latest_usage timestamp without time zone,
  latest_transaction timestamp without time zone
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with usage_rows as (
    select u.coupon_id as cid, u."timestamp" as happened_at
    from public.coupon_usage u
    where u.coupon_id = any(p_coupon_ids)
      and not public.is_hidden_ledger_row(coalesce(nullif(u.details, ''), nullif(u.action, ''), ''))
  ),
  transaction_rows as (
    select t.coupon_id as cid, t.transaction_date as happened_at
    from public.coupon_transaction t
    where t.coupon_id = any(p_coupon_ids)
      and not public.is_hidden_ledger_row(coalesce(nullif(t.location, ''), nullif(t.source, ''), ''))
  ),
  per_coupon as (
    select r.cid, count(*)::integer as n, max(r.happened_at) as latest, null::timestamp as latest_tx
    from usage_rows r group by r.cid
    union all
    select r.cid, count(*)::integer, null::timestamp, max(r.happened_at)
    from transaction_rows r group by r.cid
  )
  select p.cid, sum(p.n)::integer, max(p.latest), max(p.latest_tx)
  from per_coupon p
  group by p.cid;
$$;

revoke execute on function public.is_hidden_ledger_row(text) from public, anon;
grant execute on function public.is_hidden_ledger_row(text) to authenticated;
revoke execute on function public.coupon_usage_stats(integer[]) from public, anon;
grant execute on function public.coupon_usage_stats(integer[]) to authenticated;
