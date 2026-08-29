-- Coupon sharing is an invitation, never an immediate grant.
-- `shared` keeps one coupon row as the source of truth for both users.
-- `transfer` moves that row to the recipient when they accept.

alter table public.coupon_shares
  add column if not exists share_type text not null default 'shared',
  add column if not exists recipient_email text;

update public.coupon_shares s
set recipient_email = lower(u.email)
from public.users u
where s.shared_with_user_id = u.id
  and s.recipient_email is null;

alter table public.coupon_shares
  drop constraint if exists coupon_shares_share_type_check;
alter table public.coupon_shares
  add constraint coupon_shares_share_type_check
  check (share_type in ('shared', 'transfer'));

create unique index if not exists coupon_shares_one_open_invite
  on public.coupon_shares (coupon_id, shared_with_user_id)
  where status = 'pending';

create policy coupon_usage_shared_recipient_select on public.coupon_usage
  for select to authenticated
  using (exists (
    select 1 from public.coupon_shares s
    where s.coupon_id = coupon_usage.coupon_id
      and s.shared_with_user_id = public.app_user_id()
      and s.share_type = 'shared' and s.status = 'accepted'
      and s.share_expires_at > now()
  ));

create policy coupon_transaction_shared_recipient_select on public.coupon_transaction
  for select to authenticated
  using (exists (
    select 1 from public.coupon_shares s
    where s.coupon_id = coupon_transaction.coupon_id
      and s.shared_with_user_id = public.app_user_id()
      and s.share_type = 'shared' and s.status = 'accepted'
      and s.share_expires_at > now()
  ));

create or replace function public.respond_to_coupon_share(
  p_share_id integer,
  p_accept boolean
)
returns table (share_id integer, new_status text, coupon_id integer, share_type text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user integer;
  v_share public.coupon_shares%rowtype;
begin
  v_user := public.app_user_id();
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_share
  from public.coupon_shares
  where id = p_share_id
  for update;

  if not found or v_share.shared_with_user_id <> v_user then
    raise exception 'SHARE_NOT_FOUND' using errcode = '42501';
  end if;
  if v_share.status <> 'pending' or v_share.share_expires_at <= now() then
    raise exception 'SHARE_NOT_PENDING' using errcode = '22023';
  end if;

  if not p_accept then
    update public.coupon_shares set status = 'declined' where id = p_share_id;
    return query select v_share.id, 'declined'::text, v_share.coupon_id, v_share.share_type;
    return;
  end if;

  -- Lock ownership together with the invitation. No transfer can partially apply.
  perform 1 from public.coupon
   where id = v_share.coupon_id and user_id = v_share.shared_by_user_id
   for update;
  if not found then
    raise exception 'COUPON_NOT_FOUND' using errcode = '42501';
  end if;

  if v_share.share_type = 'transfer' then
    update public.coupon set user_id = v_user where id = v_share.coupon_id;
    update public.coupon_shares
       set status = 'transferred', accepted_at = now()
     where id = p_share_id;
    -- Any other grants from the former owner no longer apply.
    update public.coupon_shares
       set status = 'revoked', revoked_at = now()
     where coupon_id = v_share.coupon_id
       and id <> p_share_id
       and status in ('pending', 'accepted');
    return query select v_share.id, 'transferred'::text, v_share.coupon_id, v_share.share_type;
  else
    update public.coupon_shares
       set status = 'accepted', accepted_at = now()
     where id = p_share_id;
    return query select v_share.id, 'accepted'::text, v_share.coupon_id, v_share.share_type;
  end if;
end;
$$;

revoke execute on function public.respond_to_coupon_share(integer, boolean) from public, anon;
grant execute on function public.respond_to_coupon_share(integer, boolean) to authenticated;

-- Shared recipients may spend from the same locked balance. Transfer recipients
-- become the owner, so the same predicate covers them after acceptance.
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
  v_user integer;
  v_value double precision;
  v_used double precision;
  v_new double precision;
begin
  v_user := public.app_user_id();
  if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_used_amount is null or p_used_amount <= 0 or p_used_amount = 'NaN'::double precision then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
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

  v_new := least(v_value, v_used + p_used_amount);
  insert into public.coupon_usage (
    coupon_id, used_amount, action, details, place_name, place_address,
    latitude, longitude, timestamp
  ) values (
    p_coupon_id, p_used_amount, 'usage', nullif(btrim(coalesce(p_details, '')), ''),
    nullif(btrim(coalesce(p_place_name, '')), ''), nullif(btrim(coalesce(p_place_address, '')), ''),
    p_latitude, p_longitude,
    coalesce(nullif(p_timestamp, '')::timestamptz at time zone 'utc', now() at time zone 'utc')
  );
  update public.coupon set used_value = v_new,
    status = case when v_new >= v_value then 'נוצל' else 'פעיל' end
  where id = p_coupon_id;
  return query select v_new, v_new >= v_value;
end;
$$;
