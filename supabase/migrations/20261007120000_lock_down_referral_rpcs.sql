-- Security audit 2026-10-07.
--
-- These SECURITY DEFINER functions were only revoked from PUBLIC. Supabase's
-- default privileges grant EXECUTE on new public functions directly to anon
-- and authenticated, so they stayed callable by anyone holding the public
-- anon key. claim_referral trusts p_user_id, so an anonymous caller could
-- attribute any new signup to their own partner chain.
--
-- The only legitimate callers are the claim-referral edge function and other
-- SECURITY DEFINER functions, which run as service_role / the owner.
revoke execute on function public.claim_referral(integer, text, text) from public, anon, authenticated;
revoke execute on function public.refresh_referral_progress(bigint) from public, anon, authenticated;
revoke execute on function public.referral_default_rewards(bigint) from public, anon, authenticated;
revoke execute on function public.referral_activity_days(integer, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.referral_fraud_reasons(bigint) from public, anon, authenticated;
revoke execute on function public.referral_resolve_code(text) from public, anon, authenticated;
revoke execute on function public.referral_code_taken(text) from public, anon, authenticated;
revoke execute on function public.prune_login_attempts() from public, anon, authenticated;

grant execute on function public.claim_referral(integer, text, text) to service_role;
grant execute on function public.refresh_referral_progress(bigint) to service_role;
grant execute on function public.referral_default_rewards(bigint) to service_role;
grant execute on function public.referral_activity_days(integer, timestamptz, timestamptz) to service_role;
grant execute on function public.referral_fraud_reasons(bigint) to service_role;
grant execute on function public.referral_resolve_code(text) to service_role;
grant execute on function public.referral_code_taken(text) to service_role;
grant execute on function public.prune_login_attempts() to service_role;

-- referral_applications: the INSERT policy was WITH CHECK (true), so any user
-- could insert pre-approved applications in someone else's name.
-- referral_apply() (SECURITY DEFINER) is now the only write path.
drop policy if exists "authenticated can insert" on public.referral_applications;
revoke insert on public.referral_applications from authenticated, anon;
