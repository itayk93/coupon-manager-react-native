import React, { useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  TouchableOpacity,
  type StyleProp,
  type TouchableOpacityProps,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useNativeDriver } from "@/lib/animation";

/**
 * One element, not a wrapper around one. An outer pressable holding a styled
 * inner view breaks every caller whose style carries the layout: a grid cell
 * sized at 48% ends up on a child while the flex item itself has no width, and
 * the KPI grid collapses into ragged columns.
 *
 * `TouchableOpacity` and not `Pressable` because every touch target this
 * replaces was already a `TouchableOpacity`. Keeping the same primitive means
 * the change is the animation and nothing else — no new tap semantics to
 * re-test on a screen that is mostly taps. `CouponCard` animates one the same
 * way.
 */
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * A pressable that dips under the finger and springs back.
 *
 * The app had no press feedback beyond `activeOpacity`, which on a phone reads
 * as nothing at all: a fade of 0.7 over a white card is invisible in daylight,
 * and in a PWA there is no platform ripple to fall back on. A small scale is
 * the one cue that survives both.
 *
 * Deliberately understated. The dip is 3% on a card and finishes in 90ms,
 * because this fires on every tap in the app and anything larger turns a list
 * into a trampoline. The release spring is what makes it feel physical rather
 * than mechanical.
 *
 * Built on RN's `Animated`: `useNativeDriver` already switches itself off on
 * web, and transforms are the one property react-native-web animates without
 * dropping frames.
 */

type Props = Omit<TouchableOpacityProps, "style"> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far to dip. Smaller for big surfaces, larger for small controls. */
  scaleTo?: number;
  /** A selection tick on press-in. Native only; web has no equivalent. */
  haptic?: boolean;
};

const PRESS_MS = 90;

export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  haptic = false,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const press = (toValue: number) => {
    Animated.timing(scale, {
      toValue,
      duration: PRESS_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver,
    }).start();
  };

  const release = () => {
    Animated.spring(scale, {
      toValue: 1,
      // Slightly under-damped: the surface overshoots by a hair on the way
      // back, which is what separates "released" from "reset".
      damping: 14,
      stiffness: 260,
      mass: 0.6,
      useNativeDriver,
    }).start();
  };

  return (
    <AnimatedTouchable
      {...rest}
      disabled={disabled}
      // The scale is the feedback now, so the stock fade is dialled right down
      // rather than compounding with it.
      activeOpacity={0.92}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(event) => {
        if (!disabled) {
          press(scaleTo);
          if (haptic && Platform.OS !== "web") {
            void Haptics.selectionAsync().catch(() => {});
          }
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        release();
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedTouchable>
  );
}
