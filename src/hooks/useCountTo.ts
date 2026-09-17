import { useEffect, useRef, useState } from "react";
import { useReduceMotion } from "@/hooks/useReduceMotion";

/** Long enough to read as movement, short enough not to delay the real number. */
const DURATION_MS = 700;
const TICK_MS = 32;

/**
 * Counts from the previous value to the new one when it changes.
 *
 * Deliberately not `CountUp` from the onboarding celebration, which always
 * starts at zero: that is a reveal, and this is a correction. A wallet that
 * drops from ₪1,240 to ₪1,160 should travel those 80 shekels, not re-count
 * the whole balance from nothing every time a coupon is used.
 *
 * The first value is shown as-is. An amount that animates on mount reads as
 * the screen loading rather than as the user's money changing, and says
 * nothing — the point is to show the delta the user just caused. `fromZero`
 * opts out of that for a celebration figure, where the whole amount arriving
 * from nothing is exactly the point.
 */
export function useCountTo(value: number, enabled = true, fromZero = false): number {
  const reduceMotion = useReduceMotion();
  const animateOnMount = enabled && fromZero && !reduceMotion;
  const [shown, setShown] = useState(animateOnMount ? 0 : value);
  const from = useRef(animateOnMount ? 0 : value);
  const mounted = useRef(false);

  useEffect(() => {
    // A celebration figure is a reveal and starts at zero; a balance is a
    // correction and starts where it was. Only the reveal animates on mount.
    if (!mounted.current && !animateOnMount) {
      mounted.current = true;
      from.current = value;
      setShown(value);
      return;
    }
    mounted.current = true;
    if (!enabled || reduceMotion) {
      from.current = value;
      setShown(value);
      return;
    }

    const start = Date.now();
    const origin = from.current;
    const distance = value - origin;
    if (distance === 0) return;

    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - start) / DURATION_MS);
      // Ease-out, so the last digits settle instead of slamming into place.
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(origin + distance * eased);
      setShown(next);
      if (progress >= 1) {
        from.current = value;
        clearInterval(timer);
      }
    }, TICK_MS);

    return () => {
      clearInterval(timer);
      from.current = value;
    };
  }, [value, enabled, reduceMotion]);

  return shown;
}
