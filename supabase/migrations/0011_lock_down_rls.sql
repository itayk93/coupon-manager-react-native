-- 0011: Close the anon hole and express every policy in terms of the JWT.
--
-- BREAKING. Do not apply until every client obtains a real session:
--   * web  — shipped, uses supabase.functions.invoke('legacy-login')
--   * iOS  — must call the same legacy-login endpoint and set the returned
--            session before this runs, otherwise it loses all data access.
--
-- Two separate defects are fixed here:
--
--  1. Blanket policies granted to `anon` with `using (true)` (named
--     *_anon_ios, simple_ios_access, iOS_App_Read_Access). Postgres ORs
--     permissive policies together, so a single `true` policy defeats every
--     other policy on the table. With the anon key being public by design,
--     this made the whole database world-readable and world-writable.
--
--  2. The remaining per-user policies compare `((auth.uid())::text)::integer`
--     to an integer user_id. auth.uid() is a uuid, so that cast raises and the
--     policy can never grant anything. They are replaced with app_user_id(),
--     which maps the JWT to the legacy integer id via users.auth_user_id.

-- ---------------------------------------------------------------------------
-- 1. Drop every existing policy on the application tables.
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename <> 'alembic_version'
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. RLS on for every table, including the ones that never had it.
-- ---------------------------------------------------------------------------
do $$
declare
  tbl record;
begin
  for tbl in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    -- enable, not force: app_user_id()/is_app_admin() are security definer
    -- functions owned by the table owner. FORCE would subject them to the very
    -- policies that call them, which recurses.
    execute format('alter table public.%I enable row level security', tbl.relname);
  end loop;
end;
$$;

-- No table is reachable by an unauthenticated caller from here on. Anything
-- genuinely public (the marketplace listing below) opts in explicitly.
revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. users
-- ---------------------------------------------------------------------------
revoke select (password) on public.users from anon, authenticated;

create policy users_select_own on public.users
  for select to authenticated
  using (id = public.app_user_id() or public.is_app_admin());

-- Column-level escalation is blocked by guard_users_self_update (0010).
create policy users_update_own on public.users
  for update to authenticated
  using (id = public.app_user_id())
  with check (id = public.app_user_id());

create policy users_admin_all on public.users
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- 4. Tables owned directly via user_id
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'auto_update_runs', 'gpt_usage', 'notifications', 'opt_outs',
    'push_subscriptions', 'telegram_users', 'user_consents',
    'user_feature_overrides', 'user_tour_progress', 'user_activities',
    'newsletter_sendings'
  ]
  loop
    execute format($f$
      create policy %1$s_own on public.%1$I
        for all to authenticated
        using (user_id = public.app_user_id() or public.is_app_admin())
        with check (user_id = public.app_user_id() or public.is_app_admin())
    $f$, tbl);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. coupon — owned rows, plus an explicit public marketplace view
-- ---------------------------------------------------------------------------
create policy coupon_own on public.coupon
  for all to authenticated
  using (user_id = public.app_user_id() or public.is_app_admin())
  with check (user_id = public.app_user_id() or public.is_app_admin());

-- Deliberately readable by signed-in users only: listings are visible, but the
-- anon key alone is no longer enough to enumerate them.
create policy coupon_marketplace_select on public.coupon
  for select to authenticated
  using (is_for_sale = true and status = 'פעיל');

-- ---------------------------------------------------------------------------
-- 6. Tables owned indirectly, through coupon
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'coupon_tags', 'coupon_transaction', 'coupon_usage',
    'coupon_shares', 'coupon_active_viewers'
  ]
  loop
    execute format($f$
      create policy %1$s_via_coupon on public.%1$I
        for all to authenticated
        using (
          public.is_app_admin() or exists (
            select 1 from public.coupon c
            where c.id = %1$I.coupon_id and c.user_id = public.app_user_id()
          )
        )
        with check (
          public.is_app_admin() or exists (
            select 1 from public.coupon c
            where c.id = %1$I.coupon_id and c.user_id = public.app_user_id()
          )
        )
    $f$, tbl);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. transactions — visible to both sides of the trade
-- ---------------------------------------------------------------------------
create policy transactions_participant on public.transactions
  for all to authenticated
  using (
    public.is_app_admin()
    or buyer_id = public.app_user_id()
    or seller_id = public.app_user_id()
  )
  with check (
    public.is_app_admin()
    or buyer_id = public.app_user_id()
    or seller_id = public.app_user_id()
  );

-- ---------------------------------------------------------------------------
-- 8. Read-only reference data for signed-in users
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['companies', 'tag', 'feature_access', 'admin_messages']
  loop
    execute format($f$
      create policy %1$s_read on public.%1$I
        for select to authenticated using (true)
    $f$, tbl);
    execute format($f$
      create policy %1$s_admin_write on public.%1$I
        for all to authenticated
        using (public.is_app_admin()) with check (public.is_app_admin())
    $f$, tbl);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Admin-only tables. Everything not listed anywhere in this file has RLS
--    enabled with no policy at all, i.e. reachable only via service_role
--    (Edge Functions and scheduled jobs), which is the intent.
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'admin_settings', 'newsletters', 'scheduled_tasks', 'bot_settings',
    'notification_settings', 'daily_email_status', 'task_execution_logs'
  ]
  loop
    execute format($f$
      create policy %1$s_admin_only on public.%1$I
        for all to authenticated
        using (public.is_app_admin()) with check (public.is_app_admin())
    $f$, tbl);
  end loop;
end;
$$;
