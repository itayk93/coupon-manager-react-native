import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useNativeDriver } from "@/lib/animation";
import type { ExpiryEmphasis } from "@/lib/expiryUrgency";

/**
 * The highlight that crosses the expiry banner.
 *
 * `peek` sweeps it once, then the banner is still forever — the pattern Honey
 * and Rakuten use on a card worth noticing. `breathing` fades the same layer
 * in and out slowly, and is reserved for the last 48 hours, where a loop is
 * telling the truth rather than shouting.
 *
 * Built on RN's `Animated`, which is what the rest of the web-visible motion
 * in this app runs on, with `useNativeDriver` already switching itself off on
 * web. The character rig's Reanimated is kept for the character itself.
 *
 * Only `opacity` and `translateX` are touched. Animating a shadow radius or a
 * colour drops to the JS thread on every frame and reads as a stutter in a
 * PWA under Safari.
 */

const SWEEP_MS = 900;
const SWEEP_DELAY_MS = 420;
const BREATH_MS = 2400;
// The wash sits under the text, so it cannot blur it — but it does shift the
// contrast the text is read against, and the urgent tone is already red on
// red. Kept low enough that the banner still reads as one surface.
const BREATH_MAX = 0.28;
const BREATH_MIN = 0.1;

type Props = {
  emphasis: ExpiryEmphasis;
  /** The banner's own accent, so the glow belongs to it. */
  color: string;
  /** Matches the banner's corner radius so the layer cannot square it off. */
  radius: number;
};

export function ExpiryGlow({ emphasis, color, radius }: Props) {
  const reduceMotion = useReducedMotion();
  // The travel distance comes from the window rather than the banner's own
  // measured width: `onLayout` had not fired by the time the sweep was due, so
  // the layer never rendered. The banner is a full-width strip minus margins,
  // the sweep is clipped by its `overflow: hidden`, and a few points of
  // overshoot at either end are invisible.
  const { width } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.stopAnimation();
    breath.stopAnimation();

    if (emphasis === "static") {
      progress.setValue(0);
      breath.setValue(0);
      return;
    }

    // Reduced motion gets the resting state, not a frozen mid-animation frame:
    // nothing at all for the one-off sweep, a steady dim wash for the urgent
    // one, so the urgency is still visible without anything moving.
    if (reduceMotion) {
      progress.setValue(0);
      breath.setValue(emphasis === "breathing" ? BREATH_MIN : 0);
      return;
    }

    if (emphasis === "peek") {
      breath.setValue(0);
      progress.setValue(0);
      // The delay lets the screen settle first. A sweep that plays during the
      // mount animation is a sweep nobody sees.
      const animation = Animated.timing(progress, {
        toValue: 1,
        duration: SWEEP_MS,
        delay: SWEEP_DELAY_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver,
      });
      animation.start();
      return () => animation.stop();
    }

    progress.setValue(0);
    breath.setValue(BREATH_MIN);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: BREATH_MAX,
          duration: BREATH_MS / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(breath, {
          toValue: BREATH_MIN,
          duration: BREATH_MS / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [emphasis, reduceMotion, progress, breath]);

  const sweepWidth = width * 0.45;
  const travel = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        // Starts fully off one edge and leaves past the other, so neither end
        // of the travel leaves a stationary band sitting on the banner.
        outputRange: [-sweepWidth, width],
      }),
    [progress, sweepWidth, width],
  );
  const sweepOpacity = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 0.15, 0.85, 1],
        outputRange: [0, 0.55, 0.55, 0],
      }),
    [progress],
  );

  if (emphasis === "static") return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}
    >
      {emphasis === "breathing" ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: breath, backgroundColor: color }]}
        />
      ) : (
        <Animated.View
          style={[
            styles.sweep,
            { width: sweepWidth, opacity: sweepOpacity, transform: [{ translateX: travel }] },
          ]}
        >
          <LinearGradient
            colors={["transparent", color, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  sweep: { position: "absolute", top: 0, bottom: 0, left: 0 },
});
