-- Migration: 20260824230500_immutable_coupon_user_id.sql
-- Security Hardening: Prevent any reassignment of coupon.user_id

CREATE OR REPLACE FUNCTION public.prevent_coupon_user_id_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION 'Security violation: Reassigning coupon.user_id is strictly forbidden (coupon_id=%, old_user_id=%, new_user_id=%)', 
            OLD.id, OLD.user_id, NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_coupon_user_id_change ON public.coupon;
CREATE TRIGGER trg_prevent_coupon_user_id_change
BEFORE UPDATE ON public.coupon
FOR EACH ROW
EXECUTE FUNCTION public.prevent_coupon_user_id_change();
