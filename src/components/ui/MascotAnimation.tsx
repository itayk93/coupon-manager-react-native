import React, { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, AppState, Image, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

/**
 * The five states Kuponi actually has, plus the 6-7 easter egg.
 *
 * There were eleven names for these five rows, so `concerned`, `anxious`,
 * `panic` and `emergency` were one animation wearing four labels and promising
 * a four-step escalation the atlas cannot draw. The nine real steps exist only
 * in the widget series (`assets/mascot/widget-originals/`). Loudness inside
 * `concerned` belongs to `expiryUrgency.ts`, not to a second name.
 */
export type MascotState = "calm" | "talking" | "scanning" | "cheering" | "concerned" | "six-seven";
const ATLASES = [
  require("../../../assets/mascot/3d/scan-smooth.webp"),
  require("../../../assets/mascot/3d/greeting-smooth.webp"),
  require("../../../assets/mascot/3d/success-smooth.webp"),
  require("../../../assets/mascot/3d/concern-smooth.webp"),
  require("../../../assets/mascot/3d/six-seven-smooth.webp"),
];
const FRAME_COUNT = 36;
const GRID = 6;
const FPS = 24;
const ROW: Record<MascotState, number> = {
  calm: 0, scanning: 0, talking: 1, cheering: 2, concerned: 3, "six-seven": 4,
};

/** One resident atlas avoids image loading and decode churn between frames. */
export function MascotAnimation({ size = 132, state = "calm", reduceMotion, accessibilityLabel }: {
  size?: number;
  state?: MascotState;
  reduceMotion?: boolean;
  accessibilityLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const [systemReduced, setSystemReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [loadedRow, setLoadedRow] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const row = ROW[state];
  const paused = systemReduced || reduceMotion === true || !active || !focused || loadedRow !== row;

  useEffect(() => {
    let alive = true;
    let changed = false;
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", value => {
      changed = true;
      setSystemReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (alive && !changed) setSystemReduced(value);
    }).catch(() => { /* Keep the static accessible fallback. */ });
    const app = AppState.addEventListener("change", value => setActive(value === "active"));
    return () => { alive = false; motion.remove(); app.remove(); };
  }, []);

  useEffect(() => {
    setStep(0);
    if (paused) return;
    const started = performance.now();
    // Follow elapsed time so a busy JS thread skips frames rather than slowing
    // the action or accumulating delayed callbacks.
    const timer = setInterval(() => setStep(Math.floor((performance.now() - started) * FPS / 1000) % FRAME_COUNT), 1000 / FPS);
    return () => clearInterval(timer);
  }, [paused, state]);

  const frame = paused ? 0 : step;
  const column = frame % GRID;
  const frameRow = Math.floor(frame / GRID);
  return (
    <View accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? "auto" : "no-hide-descendants"}
      pointerEvents="none" style={[styles.viewport, { width: size, height: size }]}>
      <Image key={row} source={ATLASES[row]} accessible={false} resizeMode="stretch" fadeDuration={0}
        onLoad={() => setLoadedRow(row)}
        style={{ position: "absolute", width: size * GRID, height: size * GRID, start: 0, top: 0,
          transform: [{ translateX: -column * size }, { translateY: -frameRow * size }] }} />
    </View>
  );
}

const styles = StyleSheet.create({ viewport: { overflow: "hidden", direction: "ltr", flexShrink: 0 } });
