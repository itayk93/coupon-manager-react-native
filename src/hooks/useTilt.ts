import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { subscribeToTilt } from "@/lib/deviceTilt";

/**
 * Device roll as an Animated.Value in degrees, shared through a single sensor
 * subscription. `active` stays false where no motion sensor reports anything
 * (web, simulator), so callers can skip tilt-only decoration entirely.
 */
export function useTiltValue() {
  const roll = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(false);

  useEffect(
    () =>
      subscribeToTilt(({ roll: value }) => {
        setActive(true);
        roll.setValue(value);
      }),
    [roll],
  );

  return { roll, active };
}
