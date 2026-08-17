import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoupons } from "@/hooks/useCoupons";
import { syncWidget } from "@/lib/widgetSync";
import { clearWidgetData, isWidgetSupported } from "../../modules/coupon-widget";

/**
 * Mirrors the coupon list into the home-screen widget's shared storage.
 * Mount once, near the root.
 */
export function useWidgetSync() {
  const { user } = useAuth();
  const { data: coupons } = useCoupons();

  useEffect(() => {
    if (!isWidgetSupported) return;

    if (!user) {
      // Don't leave coupon codes on the home screen after sign-out.
      clearWidgetData();
      return;
    }

    if (coupons) syncWidget(coupons);
  }, [user, coupons]);
}
