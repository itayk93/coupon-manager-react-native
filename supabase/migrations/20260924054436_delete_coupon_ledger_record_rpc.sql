-- Delete one ledger record and recompute the coupon's balance in one step.
--
-- The client used to do this as five round trips: delete the row, read both
-- ledger tables and the coupon, then write used_value back. A connection lost
-- between the delete and the write left the balance out of step with the
-- ledger, and two deletes racing each other could each write a stale total.
-- Here the coupon row is locked, the row deleted and the balance written in
-- one transaction.
--
-- SECURITY INVOKER on purpose: the caller's RLS decides, exactly as the direct
-- delete and update it replaces did — the coupon's owner (or an admin), and a
-- shared recipient cannot delete.
--
-- The arithmetic mirrors src/lib/couponLedger.ts: a usage row is spending
-- (-|used_amount|), a transaction row is recharge - usage, hidden Multipass
-- audit rows are left out (is_hidden_ledger_row), and usedValueFromLedger()
-- decides what was spent. A 'sum_row' source deletes nothing and only
-- recomputes, as the client did.

create or replace function public.delete_coupon_ledger_record(
  p_coupon_id integer,
  p_source text,
  p_record_id integer
)
returns table (used_value double precision, status text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_value double precision;
  v_status text;
  v_credits double precision;
  v_debits double precision;
  v_used double precision;
  v_new_status text;
begin
  if p_source not in ('coupon_usage', 'coupon_transaction', 'sum_row') then
    raise exception 'INVALID_SOURCE' using errcode = '22023';
  end if;

  select c.value, c.status into v_value, v_status
  from public.coupon c
  where c.id = p_coupon_id
  for update;
  if not found then raise exception 'COUPON_NOT_FOUND' using errcode = '42501'; end if;

  if p_source = 'coupon_usage' then
    delete from public.coupon_usage u where u.id = p_record_id and u.coupon_id = p_coupon_id;
    if not found then raise exception 'RECORD_NOT_FOUND' using errcode = '42501'; end if;
  elsif p_source = 'coupon_transaction' then
    delete from public.coupon_transaction t where t.id = p_record_id and t.coupon_id = p_coupon_id;
    if not found then raise exception 'RECORD_NOT_FOUND' using errcode = '42501'; end if;
  end if;

  with ledger as (
    select -abs(coalesce(u.used_amount, 0)) as amount
    from public.coupon_usage u
    where u.coupon_id = p_coupon_id
      and not public.is_hidden_ledger_row(coalesce(nullif(u.details, ''), nullif(u.action, ''), ''))
    union all
    select coalesce(t.recharge_amount, 0) - coalesce(t.usage_amount, 0)
    from public.coupon_transaction t
    where t.coupon_id = p_coupon_id
      and not public.is_hidden_ledger_row(coalesce(nullif(t.location, ''), nullif(t.source, ''), ''))
  )
  select coalesce(sum(amount) filter (where amount > 0), 0),
         coalesce(-sum(amount) filter (where amount < 0), 0)
  into v_credits, v_debits
  from ledger;

  -- usedValueFromLedger(): a ledger with its own loadings is complete, so
  -- spending is value - balance; a usages-only ledger is spending directly.
  v_used := case when v_credits > 0 then v_value - (v_credits - v_debits) else v_debits end;
  v_used := least(v_value, greatest(0, v_used));

  -- Statuses other than active/used (sold, expired...) are left as they are.
  v_new_status := case
    when v_status in ('נוצל', 'פעיל') or v_status is null
      then case when v_used >= v_value then 'נוצל' else 'פעיל' end
    else v_status
  end;

  update public.coupon c set used_value = v_used, status = v_new_status where c.id = p_coupon_id;

  return query select v_used, v_new_status;
end;
$$;

revoke execute on function public.delete_coupon_ledger_record(integer, text, integer) from public, anon;
grant execute on function public.delete_coupon_ledger_record(integer, text, integer) to authenticated;
