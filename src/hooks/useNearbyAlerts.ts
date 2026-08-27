import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { useCoupons } from "@/hooks/useCoupons";
import { useWhereBought } from "@/hooks/useWhereBought";
import {
  isNearbyEnabled,
  requestNearbyPermission,
  stopNearbyGeofences,
  syncNearbyGeofences,
} from "@/lib/nearbyAlerts";

/**
 * The switch and the wiring for the "you are near a shop" alert.
 *
 * The places come from the purchase map — where this person has actually
 * spent a coupon before — and the wallet says where they still have money.
 * Nothing new is fetched: both queries are already on screen elsewhere.
 *
 * Geofences are re-registered whenever either side changes, because a region
 * left over for a coupon that has since been spent is a notification about
 * money that is not there.
 */
export function useNearbyAlerts() {
  const { data: coupons = [] } = useCoupons();
  const { data: places = [] } = useWhereBought();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(0);

  const supported = Platform.OS === "ios" || Platform.OS === "android";

  useEffect(() => {
    let active = true;
    void isNearbyEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!enabled || !supported) return;
    let active = true;
    void syncNearbyGeofences(
      coupons.map((coupon) => ({
        id: coupon.id,
        company: coupon.company,
        value: coupon.value,
        used_value: coupon.used_value,
        status: coupon.status,
      })),
      places.map((place) => ({
        name: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
      })),
    ).then((result) => {
      if (active) setWatching(result.watching);
    });
    return () => { active = false; };
  }, [coupons, enabled, places, supported]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const granted = await requestNearbyPermission();
      setEnabled(granted);
      return granted;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await stopNearbyGeofences();
      setEnabled(false);
      setWatching(0);
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * "Always" cannot be re-requested once refused — the only route back is the
   * system settings app, so the UI has to say so rather than offer a switch
   * that silently does nothing.
   */
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (!supported) return;
    let active = true;
    void Location.getBackgroundPermissionsAsync()
      .then((result) => {
        if (active) setBlocked(!result.granted && !result.canAskAgain);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [supported]);

  return { supported, enabled, blocked, busy, watching, enable, disable };
}
