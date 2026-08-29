-- A name field that accepts a URL is a place to publish.
--
-- Eight accounts had put a phishing line into `first_name` — "You have received
-- a $3,247.00 credit… confirm the transfer here: http://…" — and the admin user
-- list rendered it, because a name is a name. None of them ever confirmed an
-- email or added a coupon; the signup was only ever a way to get the sentence
-- onto a screen somebody trusts. The rows are gone.
--
-- The guard goes on the table rather than on a form. These arrived through the
-- legacy signup, which is a different codebase, and the next one will arrive
-- through whichever entry point nobody is looking at — but every entry point
-- ends at this insert. A constraint here is the only version of this fix that
-- does not have to be repeated.
--
-- Deliberately narrow: a scheme or a bare `www.`, not "anything with a dot".
-- Real names have dots in them, and a rule that rejects them is a rule that
-- gets dropped the first time it turns a person away.

alter table public.users
  drop constraint if exists users_names_carry_no_links;

alter table public.users
  add constraint users_names_carry_no_links check (
    coalesce(first_name, '') !~* '(https?://|www\.)'
    and coalesce(last_name, '') !~* '(https?://|www\.)'
  );
