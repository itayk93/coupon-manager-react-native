-- guard_users_self_update froze the columns a client must not choose for
-- itself, and decided who a client was by "not service_role". The auth admin
-- is not service_role either.
--
-- So handle_auth_user_created, which links a new auth.users row back to the
-- app row by email, had its `auth_user_id = excluded.auth_user_id` quietly
-- reverted on the ON CONFLICT DO UPDATE path — every time an existing account
-- registered again. The link stayed null, app_user_id() returned null, RLS hid
-- the person's own row from them, and the app read that as "this user was
-- deleted or blocked" on the login screen. Two accounts were in that state.
--
-- The insert path was fine, which is why this only ever hit people who already
-- had an account. A brand new email never takes the UPDATE branch.
--
-- The clamp now keys on what it was always about: a request carrying a user's
-- JWT. Trigger and service-role writes have no auth.uid() and pass through;
-- anything a signed-in client sends is still frozen exactly as before.
create or replace function public.guard_users_self_update()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  new.id           := old.id;
  new.email        := old.email;
  new.password     := old.password;
  new.is_admin     := old.is_admin;
  new.is_deleted   := old.is_deleted;
  new.is_confirmed := old.is_confirmed;
  new.auth_user_id := old.auth_user_id;
  new.google_id    := old.google_id;
  new.slots        := old.slots;
  new.slots_automatic_coupons := old.slots_automatic_coupons;

  return new;
end;
$function$;

-- The accounts already stranded by the above. Matched on email, which is the
-- same key handle_auth_user_created uses, and only where the app row has no
-- link at all — an existing link is never repointed.
update public.users u
set auth_user_id = a.id
from auth.users a
where lower(a.email) = lower(u.email)
  and u.auth_user_id is null
  and u.is_deleted is not true;
