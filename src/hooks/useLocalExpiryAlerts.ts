import { useEffect } from "react";
import { AppState } from "react-native";
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
    const sync = () => { void syncLocalExpiryAlerts(coupons, preferences).catch(() => {}); };
    sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => subscription.remove();
  }, [user, coupons, preferences]);
}
