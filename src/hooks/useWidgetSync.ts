import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoupons } from "@/hooks/useCoupons";
import { useProfile } from "@/hooks/useProfile";
import { syncWidget } from "@/lib/widgetSync";
import { clearWidgetData, isWidgetSupported } from "../../modules/coupon-widget";

/**
 * Mirrors the coupon list into the home-screen widget's shared storage.
 * Mount once, near the root.
 */
export function useWidgetSync() {
  const { user } = useAuth();
  const { data: coupons } = useCoupons();
  const { data: profile } = useProfile();

  // `users.allow_widget_access` predates this app. Only an explicit `false`
  // blocks: the column is nullable and most rows are null, so treating null as
  // "blocked" would silently disable the widget for nearly everyone.
  const widgetBlocked = profile?.allow_widget_access === false;

  useEffect(() => {
    if (!isWidgetSupported) return;

    if (!user || widgetBlocked) {
      // Don't leave coupon codes on the home screen after sign-out, or for a
      // user whose account disallows widget access.
      clearWidgetData();
      return;
    }

    if (coupons) syncWidget(coupons);
  }, [user, coupons, widgetBlocked]);
}
