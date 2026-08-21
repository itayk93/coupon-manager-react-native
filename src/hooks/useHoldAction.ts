import React from "react";
import { Animated, Easing, Platform } from "react-native";
import * as Haptics from "expo-haptics";

const DEFAULT_DURATION = 550;
// If the touch is cancelled (scroll steal, slight finger drift) after this
// much of the hold already filled, the intent was clearly a hold — honor it.
const CANCEL_TOLERANCE = 0.65;
// Haptic ticks along the way, so the finger feels the hold filling up.
const TICKS = [0.25, 0.5, 0.75];

type UseHoldActionOptions = {
  /** Fired once the hold completes. */
  onHold: () => void;
  /** How long the finger has to stay down, in ms. */
  duration?: number;
  enabled?: boolean;
};

/**
 * Press-and-hold as a gesture you can hang on any pressable: a progress value
 * to render, haptics that step up as it fills, and a flag telling the tap
 * handler that the hold already did the work.
 */
export function useHoldAction({
  onHold,
  duration = DEFAULT_DURATION,
  enabled = true,
}: UseHoldActionOptions) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = React.useState(false);
  const firedTicks = React.useRef(new Set<number>());
  // The hold finished its full duration, but the finger may still be down.
  const completedRef = React.useRef(false);
  // onHold has already been fired, so a tap handler should stand down.
  const heldRef = React.useRef(false);
  // Latest progress value, so a cancelled touch can still count as a hold.
  const valueRef = React.useRef(0);

  React.useEffect(() => {
    const id = progress.addListener(({ value }) => {
      valueRef.current = value;
      if (Platform.OS === "web") return;
      TICKS.forEach((tick) => {
        if (value >= tick && !firedTicks.current.has(tick)) {
          firedTicks.current.add(tick);
          Haptics.impactAsync(
            tick < 0.5
              ? Haptics.ImpactFeedbackStyle.Light
              : tick < 0.75
                ? Haptics.ImpactFeedbackStyle.Medium
                : Haptics.ImpactFeedbackStyle.Heavy,
          ).catch(() => {});
        }
      });
    });
    return () => progress.removeListener(id);
  }, [progress]);

  const reset = React.useCallback(() => {
    firedTicks.current.clear();
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const fireHold = React.useCallback(() => {
    if (heldRef.current) return;
    heldRef.current = true;
    completedRef.current = false;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    onHold();
  }, [onHold]);

  const onPressIn = React.useCallback(() => {
    if (!enabled) return;
    heldRef.current = false;
    completedRef.current = false;
    valueRef.current = 0;
    firedTicks.current.clear();
    setHolding(true);

    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      completedRef.current = true;
      setHolding(false);
      // Delay the action until the finger lifts. Opening a modal while the
      // finger is still down lets that same touch hit the freshly mounted
      // sheet and dismiss it immediately.
    });
  }, [duration, enabled, progress]);

  const onPressOut = React.useCallback(() => {
    setHolding(false);
    if (completedRef.current || valueRef.current >= CANCEL_TOLERANCE) {
      progress.stopAnimation();
      fireHold();
      reset();
      return;
    }
    progress.stopAnimation(() => reset());
  }, [fireHold, progress, reset]);

  /**
   * True when the press that just ended was a completed hold — the tap
   * handler should stand down. Reading it clears the flag.
   */
  const consumeHold = React.useCallback(() => {
    const held = heldRef.current;
    heldRef.current = false;
    return held;
  }, []);

  return { progress, holding, consumeHold, handlers: { onPressIn, onPressOut } };
}
