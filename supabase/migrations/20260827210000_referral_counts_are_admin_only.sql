-- Nobody outside the admin screen sees the tally.
--
-- The invite screen used to show whoever held a code how many people had
-- joined, activated and stayed underneath them. That is the same number the
-- pilot is paid on, and showing it to the partner turns every question about
-- the reward into an argument about a figure they watched move.
--
-- So the counts leave the client entirely. A person can still see and share
-- their own code — the chain needs that to work — and the numbers live in one
-- place: the admin tab, behind is_app_admin().

drop function if exists public.my_referral_status();

create or replace function public.my_referral_status()
returns table (code text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select k.code
  from public.referral_codes k
  where k.user_id = public.app_user_id() and k.revoked_at is null
$$;

grant execute on function public.my_referral_status() to authenticated;

-- The only reason `referral_codes` was ever readable by a client is that the
-- invite screen has to render the code. It reads it through the function
-- above, which returns exactly that one column, so the direct grant on the
-- table is a second door to the same room — and that room also holds
-- campaign_id, which says which chain a person belongs to.
drop policy if exists referral_codes_own_read on public.referral_codes;
create policy referral_codes_admin_read on public.referral_codes
  for select to authenticated using (public.is_app_admin());
