-- Soft-delete for coupons: a "recently deleted" holding area.
--
-- Deleting a coupon no longer removes the row. It stamps deleted_at and the
-- coupon drops out of every list (the vault filters deleted_at IS NULL). The
-- user can restore it from Settings -> "נמחקו לאחרונה" for 30 days, after which
-- a nightly job hard-deletes it for good.
--
-- 30 days matches the industry norm (Apple Photos, Gmail, Google Drive) and sits
-- inside the GDPR "without undue delay" window for the right to erasure. An
-- explicit account deletion still hard-deletes immediately (useDeleteAccount).

alter table public.coupon
  add column if not exists deleted_at timestamptz;

-- Only the trash needs an index; the common query is "deleted_at IS NULL" which
-- is the whole table minus a handful of rows.
create index if not exists coupon_deleted_at_idx
  on public.coupon (user_id, deleted_at)
  where deleted_at is not null;

-- Nightly purge: anything in the trash longer than 30 days is gone.
create or replace function public.purge_soft_deleted_coupons()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.coupon
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';
$$;
revoke all on function public.purge_soft_deleted_coupons() from public, anon, authenticated;

select cron.schedule(
  'coupon-soft-delete-purge',
  '15 3 * * *',
  $$select public.purge_soft_deleted_coupons();$$
);
