-- user_activities.city/region are varchar; the RETURNS TABLE declares text, so
-- coalesce(varchar, text) yields varchar and PostgREST rejects the call with
-- "structure of query does not match function result type". Cast explicitly.
create or replace function public.admin_geo_breakdown(p_days integer)
returns table (region text, city text, users bigint, events bigint)
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;
  if p_days not in (30, 90) then raise exception 'invalid range'; end if;
  return query
    select coalesce(ua.region, 'לא ידוע')::text, coalesce(ua.city, 'לא ידוע')::text,
           count(distinct ua.user_id), count(*)
    from public.user_activities ua
    where ua."timestamp" > now() - (p_days || ' days')::interval
    group by 1, 2
    order by 3 desc
    limit 200;
end;
$$;
