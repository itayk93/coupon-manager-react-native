-- Keep the automatic audit row for analytics, but mark every CI-created row
-- with the established hidden-ledger marker so the app does not render it next
-- to the source Multipass transaction.
update public.coupon_usage
set details = 'עדכון אוטומטי via Multipass daily flow'
where details = 'עדכון אוטומטי via Multipass CI flow';

-- Reference numbers are the provider's stable transaction identity.
create unique index if not exists coupon_transaction_coupon_reference_uidx
  on public.coupon_transaction (coupon_id, reference_number)
  where reference_number is not null and length(btrim(reference_number)) > 0;

-- Some providers can omit the reference. Fall back to the immutable scraped
-- fields so repeated CI runs still cannot insert the same row twice.
create unique index if not exists coupon_transaction_fallback_identity_uidx
  on public.coupon_transaction (
    coupon_id,
    transaction_date,
    coalesce(location, ''),
    coalesce(recharge_amount, 0),
    coalesce(usage_amount, 0),
    lower(coalesce(source, ''))
  )
  where reference_number is null or length(btrim(reference_number)) = 0;
