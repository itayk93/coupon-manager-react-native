import { useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoupons } from "@/hooks/useCoupons";
import { useCompanies } from "@/hooks/useAdminManagement";
import { useProfile } from "@/hooks/useProfile";
import { syncWidget } from "@/lib/widgetSync";
import { clearWidgetData, isWidgetSupported } from "../../modules/coupon-widget";

/**
 * Mirrors the coupon list into the home-screen widget's shared storage.
 * Mount once, near the root.
 */
export function useWidgetSync() {
  const { user, isLoading } = useAuth();
  const { data: coupons } = useCoupons();
  const { data: companies } = useCompanies();
  // Only used to recognise a signup anniversary; a missing profile just means
  // that one scene never fires.
  const { data: profile } = useProfile();

  // company name -> companies.image_path, for logo resolution in the widget.
  const imagePathByCompany = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const company of companies ?? []) map[company.name] = company.image_path ?? null;
    return map;
  }, [companies]);

  useEffect(() => {
    if (!isWidgetSupported) return;

    if (isLoading) return;

    if (!user) {
      // Don't leave coupon codes on the home screen after sign-out. The widget
      // itself is for every account — `users.allow_widget_access` is a legacy
      // column from the old product and deliberately not consulted here.
      clearWidgetData();
      return;
    }

    if (coupons) void syncWidget(coupons, imagePathByCompany, profile?.created_at ?? null);
  }, [isLoading, user, coupons, imagePathByCompany, profile?.created_at]);
}
