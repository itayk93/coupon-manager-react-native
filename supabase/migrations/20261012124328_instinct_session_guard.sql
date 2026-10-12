-- auth.sessions stays inaccessible to service_role. Expose only the exact
-- yes/no check through a private, tightly granted definer helper.
create function instinct_private.admin_session_valid(p_session uuid, p_auth uuid)
returns boolean language sql security definer set search_path=pg_catalog
as $$ select exists(select 1 from auth.sessions s join public.users u on u.auth_user_id=s.user_id
 where s.id=p_session and s.user_id=p_auth and u.id=1 and u.is_admin and not coalesce(u.is_deleted,false)
 and (s.not_after is null or s.not_after>now())); $$;
revoke all on function instinct_private.admin_session_valid(uuid,uuid) from public,anon,authenticated;
grant execute on function instinct_private.admin_session_valid(uuid,uuid) to service_role;
create or replace function public.instinct_admin_session_valid(p_session uuid, p_auth uuid)
returns boolean language sql security invoker set search_path=pg_catalog
as $$ select instinct_private.admin_session_valid(p_session,p_auth); $$;
