-- Attach/detach a coupon's tags atomically, and stop tag.count drifting.
--
-- useSetCouponTags ran a select-then-insert per tag name (two clients adding
-- the same new tag both miss and both insert) and then a read-modify-write on
-- tag.count (both read 4, both write 5, two links exist). The count is a plain
-- projection of coupon_tags, so it is recomputed from the links instead of
-- being incremented — a value that can be derived should not be maintained by
-- hand across two round trips.

-- No duplicate names exist today; this keeps the getOrCreate race from making
-- one, and gives the upsert below a conflict target.
create unique index if not exists tag_name_key on public.tag (name);

create or replace function public.set_coupon_tags(
  p_coupon_id integer,
  p_names     text[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user     integer;
  v_names    text[];
  v_affected integer[];
begin
  v_user := public.app_user_id();
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.coupon
     where id = p_coupon_id and user_id = v_user
  ) then
    raise exception 'COUPON_NOT_FOUND' using errcode = '42501';
  end if;

  -- Trimmed and deduped here so ' work ' and 'work' cannot become two tags.
  select coalesce(array_agg(distinct btrim(n)), '{}')
    into v_names
    from unnest(coalesce(p_names, '{}'::text[])) as n
   where btrim(n) <> '';

  -- Create whatever is missing. ON CONFLICT is the fix for the getOrCreate
  -- race: a loser gets the winner's row instead of a unique violation.
  insert into public.tag (name, count)
  select n, 0 from unnest(v_names) as n
  on conflict (name) do nothing;

  -- Every tag whose link count this call can change: the ones it is about to
  -- attach, plus the ones the coupon carries now (captured before the delete).
  select coalesce(array_agg(distinct id), '{}')
    into v_affected
    from (
      select t.id from public.tag t where t.name = any (v_names)
      union
      select ct.tag_id from public.coupon_tags ct where ct.coupon_id = p_coupon_id
    ) s(id);

  delete from public.coupon_tags ct
   where ct.coupon_id = p_coupon_id
     and ct.tag_id not in (select t.id from public.tag t where t.name = any (v_names));

  insert into public.coupon_tags (coupon_id, tag_id)
  select p_coupon_id, t.id
    from public.tag t
   where t.name = any (v_names)
  on conflict (coupon_id, tag_id) do nothing;

  -- Recomputed, not incremented.
  update public.tag t
     set count = (select count(*) from public.coupon_tags ct where ct.tag_id = t.id)
   where t.id = any (v_affected);
end;
$$;

revoke execute on function public.set_coupon_tags(integer, text[]) from public, anon;
grant execute on function public.set_coupon_tags(integer, text[]) to authenticated;
