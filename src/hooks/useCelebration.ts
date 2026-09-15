import { useEffect, useMemo, useState } from "react";
import { useCoupons } from "@/hooks/useCoupons";
import { useProfile } from "@/hooks/useProfile";
import { currentCelebration, type CelebrationScene } from "@/lib/celebrationScene";
import { buildWidgetPayload } from "@/lib/widgetSync";

/**
 * The celebration running right now, for the app to draw.
 *
 * Reads the same decision the widget does — `currentCelebration` is
 * single-flight, so asking here does not consume a milestone the widget was
 * about to show. Without this hook the ten scenes only ever existed on a
 * home-screen widget, so a user who never added one saw none of them.
 */
export function useCelebration(): CelebrationScene | null {
  const { data: coupons } = useCoupons();
  const { data: profile } = useProfile();
  const [scene, setScene] = useState<CelebrationScene | null>(null);

  // The same figure the widget uses, so the two can never disagree about
  // whether an expiry is close enough to outrank a celebration.
  const urgentDays = useMemo(
    () => (coupons ? buildWidgetPayload(coupons).urgentDaysRemaining ?? null : null),
    [coupons]
  );
  const memberSince = profile?.created_at ?? null;

  useEffect(() => {
    if (!coupons) return;
    let alive = true;
    void currentCelebration(coupons, memberSince, urgentDays)
      .then((next) => { if (alive) setScene(next); })
      .catch(() => { if (alive) setScene(null); });
    return () => { alive = false; };
  }, [coupons, memberSince, urgentDays]);

  // A scene ends at local midnight; drop it without waiting for a remount.
  useEffect(() => {
    if (!scene?.until) return;
    const ms = Date.parse(scene.until) - Date.now();
    if (!Number.isFinite(ms)) return;
    if (ms <= 0) { setScene(null); return; }
    const timer = setTimeout(() => setScene(null), ms);
    return () => clearTimeout(timer);
  }, [scene]);

  return scene;
}
