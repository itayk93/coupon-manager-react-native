-- Allow coupons to be deleted together with their transaction history.
-- The transaction rows have no meaning without their parent coupon.
ALTER TABLE public.coupon_transaction
  DROP CONSTRAINT IF EXISTS coupon_transaction_coupon_id_fkey;

ALTER TABLE public.coupon_transaction
  ADD CONSTRAINT coupon_transaction_coupon_id_fkey
  FOREIGN KEY (coupon_id)
  REFERENCES public.coupon(id)
  ON DELETE CASCADE;
