import React, { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, AppState, Image, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

export type MascotState = "talking" | "thinking" | "cheering" | "scanning" | "success" | "calm" | "concerned" | "anxious" | "panic" | "emergency";
const ATLAS = require("../../../assets/mascot/3d/mascot-atlas.png");
const ROW: Record<MascotState, number> = {
  scanning: 0, thinking: 0, calm: 0, talking: 1, cheering: 2, success: 2,
  concerned: 3, anxious: 3, panic: 3, emergency: 3,
};
const LOOP = [0, 1, 2, 3, 2, 1];
const CONCERN_LOOP = [0, 1, 2, 1];

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
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const row = ROW[state];
  const sequence = row === 3 ? CONCERN_LOOP : LOOP;
  const paused = systemReduced || reduceMotion === true || !active || !focused || !loaded;

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
    const timer = setInterval(() => setStep(value => (value + 1) % sequence.length), 260);
    return () => clearInterval(timer);
  }, [paused, sequence, state]);

  const column = paused ? 0 : sequence[step % sequence.length];
  return (
    <View accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? "auto" : "no-hide-descendants"}
      pointerEvents="none" style={[styles.viewport, { width: size, height: size }]}>
      <Image source={ATLAS} accessible={false} resizeMode="stretch" fadeDuration={0}
        onLoad={() => setLoaded(true)}
        style={{ position: "absolute", width: size * 4, height: size * 4, start: 0, top: 0,
          transform: [{ translateX: -column * size }, { translateY: -row * size }] }} />
    </View>
  );
}

const styles = StyleSheet.create({ viewport: { overflow: "hidden", direction: "ltr", flexShrink: 0 } });
