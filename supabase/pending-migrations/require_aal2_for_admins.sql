-- Server-side half of the admin-panel second factor.
--
-- The client gate (AdminMfaGate) decides what is drawn; this decides what the
-- database will answer. Move this file into supabase/migrations with a fresh
-- timestamp only after every production admin has a verified TOTP factor — the
-- precondition below turns an unsafe rollout into a failed deployment instead
-- of an admin lockout.
DO $migration$
DECLARE
  unenrolled_admins integer;
BEGIN
  SELECT count(*)
    INTO unenrolled_admins
  FROM public.users AS u
  WHERE u.is_admin
    AND u.is_deleted IS NOT TRUE
    AND u.auth_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM auth.mfa_factors AS factors
      WHERE factors.user_id = u.auth_user_id
        AND factors.factor_type = 'totp'
        AND factors.status = 'verified'
    );

  IF unenrolled_admins > 0 THEN
    RAISE EXCEPTION
      'Cannot enable server-side MFA: % administrator account(s) lack a verified TOTP factor',
      unenrolled_admins;
  END IF;
END
$migration$;

-- Only the admin path gains the requirement. Ordinary users authenticate at
-- aal1 and keep every policy that does not go through is_app_admin().
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT coalesce(
    (SELECT u.is_admin
     FROM public.users u
     WHERE u.auth_user_id = auth.uid()
       AND u.is_deleted IS NOT TRUE),
    false)
  AND coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$function$;
