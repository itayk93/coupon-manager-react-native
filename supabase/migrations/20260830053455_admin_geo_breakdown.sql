-- Admin-only city/region breakdown for the Geo Analytics tab.
-- No join: enrich-ip-geo stamps city/region directly onto user_activities.
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
    select coalesce(ua.region, 'לא ידוע'), coalesce(ua.city, 'לא ידוע'),
           count(distinct ua.user_id), count(*)
    from public.user_activities ua
    where ua."timestamp" > now() - (p_days || ' days')::interval
    group by 1, 2
    order by 3 desc
    limit 200;
end;
$$;

revoke all on function public.admin_geo_breakdown(integer) from public, anon;
grant execute on function public.admin_geo_breakdown(integer) to authenticated;
