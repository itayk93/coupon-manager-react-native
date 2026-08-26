-- coupon_places is a shared cache, not user data.
--
-- It shipped with `for insert to authenticated with check (true)` and the same
-- for update, which lets any signed-in account rewrite the address and
-- coordinates behind every other user's place — there is no owner column to
-- scope a policy to. Nothing in the app writes it from the client: the only
-- writers are the geocode-address and backfill-coupon-places functions, both
-- of which run under the service role and bypass RLS entirely.
--
-- So the write policies buy nothing and cost a tamper surface. Reads stay.

drop policy if exists coupon_places_authenticated_write on public.coupon_places;
drop policy if exists coupon_places_authenticated_update on public.coupon_places;

revoke insert, update, delete, truncate, references, trigger
  on public.coupon_places from authenticated;
revoke all on public.coupon_places from anon;
