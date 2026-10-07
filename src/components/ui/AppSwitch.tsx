import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  I18nManager,
  Platform,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "@/contexts/ThemeContext";

/**
 * The one switch in the app, replacing the stock `Switch` on every screen.
 *
 * The stock control jumps on Android and looks different on each platform and
 * on web. This one slides, and the knob behaves like something under a finger:
 *
 * - Press in: the knob stretches toward where it is going and nudges a few
 *   pixels. Width grows, never `scaleX` — scaling squashes the round ends.
 * - Release over the switch: the value commits, a selection haptic fires and
 *   the knob springs the rest of the way with a hair of overshoot.
 * - Drag off before releasing: nothing changes and the knob slides back. You
 *   can change your mind halfway.
 *
 * On is the left side, matching iOS in Hebrew.
 *
 * Reduce Motion drops the stretch and the spring for a short plain slide.
 *
 * RN `Animated` on the JS driver, because width can't run on the native
 * driver and a 30px control costs nothing to animate on JS. No new dependency.
 */

type Props = {
  value: boolean;
  onValueChange?: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const TRACK_W = 50;
const TRACK_H = 30;
const PAD = 2;
const KNOB = TRACK_H - PAD * 2;
const TRAVEL = TRACK_W - KNOB - PAD * 2;
const STRETCH = 6;
const NUDGE = 0.18;

export function AppSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  style,
}: Props) {
  const { theme } = useAppTheme();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const stretch = useRef(new Animated.Value(0)).current;
  const committed = useRef(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) reduceMotion.current = on;
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (on) => {
      reduceMotion.current = on;
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const settle = (to: number) => {
    if (reduceMotion.current) {
      Animated.timing(progress, {
        toValue: to,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
      return;
    }
    Animated.spring(progress, {
      toValue: to,
      damping: 15,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: false,
    }).start();
  };

  // Controlled: whatever the parent says wins, including a rejected toggle.
  useEffect(() => {
    settle(value ? 1 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pressIn = () => {
    committed.current = false;
    if (reduceMotion.current) return;
    Animated.timing(stretch, {
      toValue: 1,
      duration: 110,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
    Animated.timing(progress, {
      toValue: value ? 1 - NUDGE : NUDGE,
      duration: 110,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(stretch, {
      toValue: 0,
      damping: 14,
      stiffness: 260,
      mass: 0.6,
      useNativeDriver: false,
    }).start();
    // onPress fires right after onPressOut when the finger lifts inside.
    // Wait a frame; if nothing committed, the press was abandoned.
    requestAnimationFrame(() => {
      if (!committed.current) settle(value ? 1 : 0);
    });
  };

  const press = () => {
    committed.current = true;
    if (Platform.OS !== "web") {
      void Haptics.selectionAsync().catch(() => {});
    }
    onValueChange?.(!value);
  };

  // Hebrew app: on is the left side, as iOS draws it in Hebrew. The knob is
  // anchored with `right`, which RN mirrors under native RTL, so the travel
  // direction mirrors with it.
  const dir = I18nManager.isRTL ? 1 : -1;
  // At the far end the stretched knob would overrun the track, so the extra
  // width is paid for by travelling less.
  const translateX = Animated.multiply(
    Animated.multiply(progress, dir),
    Animated.subtract(TRAVEL, Animated.multiply(stretch, STRETCH)),
  );
  const width = Animated.add(KNOB, Animated.multiply(stretch, STRETCH));
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.inputBorder, theme.primary],
    extrapolate: "clamp",
  });

  return (
    <Pressable
      onPressIn={disabled ? undefined : pressIn}
      onPressOut={disabled ? undefined : pressOut}
      onPress={disabled ? undefined : press}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      style={[{ opacity: disabled ? 0.4 : 1 }, style]}
    >
      <Animated.View style={[styles.track, { backgroundColor }]}>
        <Animated.View style={[styles.knob, { width, transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: "center",
  },
  knob: {
    position: "absolute",
    right: PAD,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
