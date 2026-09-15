import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the system asks for reduced motion.
 *
 * Starts `true` and relaxes only once the accessibility service answers, so a
 * slow or failed answer leaves the still version on screen rather than playing
 * motion at someone who asked for none. `MascotAnimation` follows the same
 * default for the same reason.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      changed = true;
      setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (alive && !changed) setReduced(value); })
      .catch(() => { /* Keep the still version. */ });
    return () => { alive = false; subscription.remove(); };
  }, []);
  return reduced;
}
