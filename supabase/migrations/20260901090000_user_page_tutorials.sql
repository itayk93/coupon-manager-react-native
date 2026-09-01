-- Generic, per-user page tutorial progress. New tutorials are stored by key,
-- avoiding one schema migration per screen while keeping the existing tour row.
alter table public.user_tour_progress
  add column if not exists tutorials jsonb not null default '{}'::jsonb;

comment on column public.user_tour_progress.tutorials is
  'Map of tutorial key to first completion timestamp, e.g. {"coupon_import":"2026-09-01T09:00:00Z"}.';

create or replace function public.mark_user_page_tutorial(
  p_user_id bigint,
  p_tutorial_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <= 0 then
    raise exception 'invalid user id';
  end if;
  if p_tutorial_key is null or p_tutorial_key !~ '^[a-z][a-z0-9_]{1,49}$' then
    raise exception 'invalid tutorial key';
  end if;

  insert into public.user_tour_progress (user_id, tutorials)
  values (
    p_user_id,
    jsonb_build_object(p_tutorial_key, to_jsonb(clock_timestamp()::text))
  )
  on conflict (user_id) do update
  set tutorials = coalesce(public.user_tour_progress.tutorials, '{}'::jsonb)
    || excluded.tutorials;
end;
$$;

revoke all on function public.mark_user_page_tutorial(bigint, text) from public, anon, authenticated;
grant execute on function public.mark_user_page_tutorial(bigint, text) to service_role;
