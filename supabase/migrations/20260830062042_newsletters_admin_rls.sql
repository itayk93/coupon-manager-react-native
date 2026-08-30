-- newsletters had RLS enabled with no policies -> total lockout for the
-- authenticated role. The RN admin "ניוזלטר" tab needs read + write for admins.
-- send-emails is unaffected: it uses the service role, which bypasses RLS.
create policy newsletters_admin_all on public.newsletters
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());
