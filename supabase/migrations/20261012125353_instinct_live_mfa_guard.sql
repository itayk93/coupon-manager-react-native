-- Require both the signed AAL2 claim and the live session/factor state.
create or replace function instinct_private.admin_session_valid(p_session uuid, p_auth uuid)
returns boolean language sql security definer set search_path=pg_catalog
as $$ select exists(select 1 from auth.sessions s
 join public.users u on u.auth_user_id=s.user_id
 join auth.mfa_factors f on f.id=s.factor_id and f.user_id=s.user_id
 where s.id=p_session and s.user_id=p_auth and s.aal='aal2' and f.status='verified'
 and u.id=1 and u.is_admin and not coalesce(u.is_deleted,false)
 and (s.not_after is null or s.not_after>now())); $$;

-- Alert history is also limited to coupons owned by the consenting user.
create or replace view instinct_private.coupon_alerts as
 select distinct t.user_id as scope_user_id,t.id,t.coupon_id,t.channel,t.sent_at,t.status,t.window_days
 from public.coupon_alerts t join public.coupon c on c.id=t.coupon_id and c.user_id=t.user_id
 where c.deleted_at is null;
