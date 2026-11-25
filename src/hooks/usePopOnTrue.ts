import React from "react";
import { Animated } from "react-native";
import { useNativeDriver } from "@/lib/animation";
import { useReduceMotion } from "@/hooks/useReduceMotion";

/**
 * One small "pop" fired when `flag` flips from false to true: the wrapped
 * content starts shrunk and springs back to full size. Used for momentary
 * confirmations (e.g. "הועתק" after a copy) where the content itself
 * changes and the pop keeps the swap from feeling like a hard cut.
 *
 * Returns a style object for an `Animated.View`. Under reduce-motion the
 * flag still drives the content swap, but the spring is skipped and the
 * style is inert (scale pinned at 1).
 */
export function usePopOnTrue(flag: boolean): { transform: { scale: Animated.Value }[] } {
  const reduceMotion = useReduceMotion();
  const scale = React.useRef(new Animated.Value(1)).current;
  const prev = React.useRef(flag);

  React.useEffect(() => {
    if (flag && !prev.current && !reduceMotion) {
      scale.setValue(0.55);
      // Quick settle: a confirmation should feel snappy, not bouncy.
      Animated.spring(scale, {
        toValue: 1,
        damping: 12,
        stiffness: 380,
        mass: 0.5,
        useNativeDriver,
      }).start();
    }
    prev.current = flag;
  }, [flag, reduceMotion, scale]);

  return { transform: [{ scale }] };
}
