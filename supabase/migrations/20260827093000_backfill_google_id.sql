-- The guard that erased auth_user_id on the ON CONFLICT DO UPDATE path erased
-- google_id in the same stroke, so a Google sign-in by somebody who already had
-- an account left the provider id unwritten. It never blocked a login —
-- google-auth looks the person up by email — but the column was meant to hold
-- it, and the guard fix (20260827090000) only stops it happening again.
--
-- Taken from auth.identities, which is where the provider states it, rather
-- than from user metadata where it is a copy.
update public.users u
set google_id = i.provider_id
from auth.identities i
where i.user_id = u.auth_user_id
  and i.provider = 'google'
  and u.google_id is null
  and u.is_deleted is not true;
