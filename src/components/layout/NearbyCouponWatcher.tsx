import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCoupons } from "@/hooks/useCoupons";
import { useWhereBought } from "@/hooks/useWhereBought";
import { nearbyCoupon, nearbyCouponIsland } from "@/lib/nearbyCoupon";
import { pushIsland } from "@/components/ui/Island";

const SHOWN_KEY = "nearby-coupon:shown:v1";

/** Local calendar date, the unit "once a day" is counted in. */
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function readShown(): Promise<Record<string, string>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(SHOWN_KEY)) || "{}");
  } catch {
    return {};
  }
}

/**
 * "You're next to a place your coupon works" — while the app is open, and only
 * for someone who has already let the app see their location (the usage form
 * and the where-bought map ask for it). This never asks: a reminder is not
 * worth a permission prompt, and it never runs in the background, which would
 * need the "always" permission and a reason the App Store accepts.
 *
 * The places are where the user's coupons were spent before (useWhereBought),
 * so there is no store directory to keep. Once a day per place.
 */
export function NearbyCouponWatcher({ enabled }: { enabled: boolean }) {
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web" || !enabled) return;
    const check = () => {
      Location.getForegroundPermissionsAsync()
        .then((permission) => setGranted(permission.granted))
        .catch(() => setGranted(false));
    };
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => subscription.remove();
  }, [enabled]);

  return enabled && granted ? <NearbyCouponCheck /> : null;
}

function NearbyCouponCheck() {
  const router = useRouter();
  const { data: coupons = [] } = useCoupons();
  const { data: places = [] } = useWhereBought();
  const [visit, setVisit] = useState(0);
  const running = useRef(false);

  // Each return to the app is a new chance to be somewhere new.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setVisit((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!places.length || !coupons.length || running.current) return;
    running.current = true;

    (async () => {
      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 200 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const today = localToday();
      const match = nearbyCoupon(position.coords, places, coupons, today);
      if (!match) return;

      const shown = await readShown();
      if (shown[match.place.id] === today) return;
      await AsyncStorage.setItem(SHOWN_KEY, JSON.stringify({ ...shown, [match.place.id]: today }));

      const publicId = match.coupon.public_id;
      pushIsland({
        ...nearbyCouponIsland(match),
        onPress: () => router.push(`/coupons/${publicId}` as any),
      });
    })()
      .catch(() => {
        // No fix, no network, a revoked permission: a reminder is optional.
      })
      .finally(() => {
        running.current = false;
      });
  }, [visit, places, coupons, router]);

  return null;
}
