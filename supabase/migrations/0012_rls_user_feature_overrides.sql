-- 0012: Enable RLS on user_feature_overrides.
--
-- Flagged by the Supabase security advisor as rls_disabled_in_public: the only
-- table in the schema with no row level security at all, so the anon key could
-- read, insert, update and delete rows freely. Feature overrides decide what a
-- user is allowed to see, which made this a self-service feature grant.
--
-- Safe to apply ahead of 0011: the table holds zero rows, so reads return the
-- same empty result before and after. The write path is closed immediately.
--
-- The one behavioural change is that an admin cannot add an override until the
-- auth cutover lands, because admin writes still go through the anon key today.
-- Nothing depends on that right now — the feature is unused in production.
--
-- 0011 drops and recreates every policy, including these, so the two agree.

alter table public.user_feature_overrides enable row level security;

create policy user_feature_overrides_own on public.user_feature_overrides
  for all to authenticated
  using (user_id = public.app_user_id() or public.is_app_admin())
  with check (user_id = public.app_user_id() or public.is_app_admin());
