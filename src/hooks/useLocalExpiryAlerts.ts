import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoupons } from "@/hooks/useCoupons";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { clearLocalExpiryAlerts, syncLocalExpiryAlerts } from "@/lib/localExpiryAlerts";

/**
 * Keeps the device's own expiry reminders in step with the wallet.
 * Mount once, near the root, alongside the widget sync.
 */
export function useLocalExpiryAlerts() {
  const { user } = useAuth();
  const { data: coupons } = useCoupons();
  const { data: preferences } = useNotificationPreferences();

  useEffect(() => {
    if (!user) {
      void clearLocalExpiryAlerts();
      return;
    }
    if (!coupons || !preferences) return;
    void syncLocalExpiryAlerts(coupons, preferences);
  }, [user, coupons, preferences]);
}
