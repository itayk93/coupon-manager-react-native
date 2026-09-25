import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, Image, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

/**
 * Every state Kuponi has, and each one is a drawn loop rather than a label.
 *
 * There were once eleven names for five rows, so `concerned`, `anxious`,
 * `panic` and `emergency` were one animation promising a four-step escalation
 * the atlas could not draw. The type was cut back to what existed, and the
 * missing steps have since been drawn: `worried` and `alarmed` are the two
 * rungs above `concerned`, mapped in `EXPIRY_PERFORMANCE`.
 *
 * `relieved` is the odd one out — a forward sequence, not a loop. It plays
 * once and holds its last frame; see the `loop` prop below.
 */
export type MascotState =
  | "calm" | "talking" | "scanning" | "cheering"
  | "concerned" | "worried" | "alarmed"
  | "relieved" | "six-seven";
const ATLASES = [
  require("../../../assets/mascot/3d/scan-smooth.webp"),
  require("../../../assets/mascot/3d/greeting-smooth.webp"),
  require("../../../assets/mascot/3d/success-smooth.webp"),
  require("../../../assets/mascot/3d/concern-smooth.webp"),
  require("../../../assets/mascot/3d/six-seven-smooth.webp"),
  require("../../../assets/mascot/3d/worried-smooth.webp"),
  require("../../../assets/mascot/3d/alarmed-smooth.webp"),
  require("../../../assets/mascot/3d/relieved-smooth.webp"),
];
const FRAME_COUNT = 36;
const GRID = 6;
const DEFAULT_FPS = 24;
const STATE_FPS: Record<MascotState, number> = {
  calm: 18, scanning: 18, concerned: 16, worried: 18,
  talking: 24, cheering: 24, alarmed: 24, relieved: 24, "six-seven": 24,
};
const ROW: Record<MascotState, number> = {
  calm: 0, scanning: 0, talking: 1, cheering: 2, concerned: 3, "six-seven": 4,
  worried: 5, alarmed: 6, relieved: 7,
};

/** One resident atlas avoids image loading and decode churn between frames. */
export function MascotAnimation({
  size = 132, state = "calm", speed = 1, loop = true, onFinish, reduceMotion, accessibilityLabel,
}: {
  size?: number;
  state?: MascotState;
  /** Playback multiplier. Above 1 the same loop reads as more agitated. */
  speed?: number;
  /** False plays the sequence once and holds its last frame. For `relieved`,
   *  which is a transition rather than a loop. */
  loop?: boolean;
  /** Called once the one-shot reaches its end, including when motion is
   *  suppressed and the end is all the viewer ever sees. */
  onFinish?: () => void;
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
  const finish = useRef(onFinish);
  useEffect(() => { finish.current = onFinish; }, [onFinish]);
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

  const fps = (STATE_FPS[state] ?? DEFAULT_FPS) * (Number.isFinite(speed) && speed > 0 ? speed : 1);
  useEffect(() => {
    setStep(0);
    if (paused) {
      // A held one-shot still has to report that it is over, or a caller
      // waiting to move on waits forever. Deferred so the caller never gets
      // the callback during its own render.
      if (!loop) {
        const settle = setTimeout(() => finish.current?.(), 0);
        return () => clearTimeout(settle);
      }
      return;
    }
    const started = performance.now();
    // Follow elapsed time so a busy JS thread skips frames rather than slowing
    // the action or accumulating delayed callbacks.
    const timer = setInterval(() => {
      const elapsed = Math.floor((performance.now() - started) * fps / 1000);
      if (loop) { setStep(elapsed % FRAME_COUNT); return; }
      if (elapsed < FRAME_COUNT - 1) { setStep(elapsed); return; }
      setStep(FRAME_COUNT - 1);
      clearInterval(timer);
      finish.current?.();
    }, 1000 / fps);
    return () => clearInterval(timer);
  }, [paused, state, fps, loop]);

  // A loop that cannot move rests on its opening pose. A one-shot rests on its
  // closing one: someone who asked for no motion should still see the outcome,
  // and for `relieved` the outcome is the whole point of playing it.
  const frame = paused ? (loop ? 0 : FRAME_COUNT - 1) : step;
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
