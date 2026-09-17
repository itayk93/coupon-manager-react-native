import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The system's reduce-motion setting, and whether it has answered yet.
 *
 * The answer is asynchronous, and until it arrives we assume motion is
 * unwanted: someone who asked for none should never catch a frame of it while
 * we wait. That default is safe for anything that can be paused and unpaused a
 * moment later, which is what `useReduceMotion` below is for.
 *
 * It is not safe for a one-shot. Something that decides "no motion, so show
 * the end state" on the first render can never take that back, and would make
 * the decision from the placeholder rather than the setting — so it waits for
 * `known` instead. A failed lookup reports `known` too, with the still version
 * standing: no answer is coming, and the alternative is waiting forever.
 */
export function useReduceMotionSetting(): { reduced: boolean; known: boolean } {
  const [state, setState] = useState({ reduced: true, known: false });
  useEffect(() => {
    let alive = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      changed = true;
      setState({ reduced: value, known: true });
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (alive && !changed) setState({ reduced: value, known: true }); })
      .catch(() => { if (alive && !changed) setState({ reduced: true, known: true }); });
    return () => { alive = false; subscription.remove(); };
  }, []);
  return state;
}

/**
 * Whether the system asks for reduced motion.
 *
 * Starts `true` and relaxes only once the accessibility service answers, so a
 * slow or failed answer leaves the still version on screen rather than playing
 * motion at someone who asked for none. `MascotAnimation` follows the same
 * default for the same reason.
 */
export function useReduceMotion(): boolean {
  return useReduceMotionSetting().reduced;
}
