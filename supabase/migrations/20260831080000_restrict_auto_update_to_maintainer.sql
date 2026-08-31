-- Automatic balance scraping is an unpublished maintainer experiment.
-- Remove accidental flags from every other account, then enforce the boundary
-- below the client and Edge Functions as well.
update public.coupon
set auto_update = false,
    auto_download_details = null
where user_id <> 1
  and (coalesce(auto_update, false) or auto_download_details is not null);

alter table public.coupon
  drop constraint if exists coupon_auto_update_maintainer_only;

alter table public.coupon
  add constraint coupon_auto_update_maintainer_only
  check (
    user_id = 1
    or (not coalesce(auto_update, false) and auto_download_details is null)
  );
