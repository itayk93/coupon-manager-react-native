import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Image, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useReduceMotionSetting } from "@/hooks/useReduceMotion";

/** Long, one-shot stories. Keep the short urgency atlas player unchanged. */
const STORIES = {
  "wallet-review": {
    atlas: require("../../../assets/mascot/stories/wallet-review-atlas.webp"),
    poster: require("../../../assets/mascot/stories/wallet-review-poster.png"),
    frames: 240, rows: 15,
  },
  "merchant-match": {
    atlas: require("../../../assets/mascot/stories/merchant-match-atlas.webp"),
    poster: require("../../../assets/mascot/stories/merchant-match-poster.png"),
    frames: 240, rows: 15,
  },
  "priority-pick": {
    atlas: require("../../../assets/mascot/stories/priority-pick-atlas.webp"),
    poster: require("../../../assets/mascot/stories/priority-pick-poster.png"),
    frames: 200, rows: 13,
  },
  "clean-month": {
    atlas: require("../../../assets/mascot/stories/clean-month-atlas.webp"),
    poster: require("../../../assets/mascot/stories/clean-month-poster.png"),
    frames: 280, rows: 18,
  },
} as const;

export type KuponiStoryName = keyof typeof STORIES;
type Props = {
  story: KuponiStoryName;
  size?: number;
  /** Stable wallet event id; change only when a new real event merits playback. */
  replayKey: string | number;
  /** Parent must pass false when hidden by a sheet or outside the viewport. */
  enabled?: boolean;
  reduceMotion?: boolean;
  onFinish?: () => void;
  onError?: () => void;
  accessibilityLabel?: string;
};

export function KuponiStory(props: Props) {
  return <StoryPlayback key={JSON.stringify([props.story, props.replayKey])} {...props} />;
}

function StoryPlayback({ story, size = 132, enabled = true, reduceMotion = false,
  onFinish, onError, accessibilityLabel }: Props) {
  const config = STORIES[story];
  const { known, reduced } = useReduceMotionSetting();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [frame, setFrame] = useState(0);
  const elapsed = useRef(0);
  const completed = useRef(false);
  const finish = useRef(onFinish);
  useEffect(() => { finish.current = onFinish; }, [onFinish]);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    const sub = AppState.addEventListener("change", value => setActive(value === "active"));
    return () => sub.remove();
  }, []);

  const staticOnly = known && (reduced || reduceMotion);
  useEffect(() => {
    if (!known || !focused || !active || !enabled || completed.current || failed) return;
    const complete = () => {
      if (completed.current) return;
      completed.current = true;
      setFrame(config.frames - 1);
      finish.current?.();
    };
    if (staticOnly) { complete(); return; }
    if (!loaded) return;
    const duration = config.frames * 50;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      elapsed.current += now - previous;
      previous = now;
      if (elapsed.current >= duration) {
        clearInterval(timer);
        complete();
      } else {
        setFrame(Math.min(config.frames - 1, Math.floor(elapsed.current / 50)));
      }
    }, 50);
    // Pauses preserve elapsed time; focus/visibility changes never replay it.
    return () => clearInterval(timer);
  }, [known, focused, active, enabled, loaded, failed, staticOnly, config.frames]);

  return (
    <View pointerEvents="none" style={[styles.viewport, { width: size, height: size }]}
      accessible={Boolean(accessibilityLabel)} accessibilityRole={accessibilityLabel ? "image" : undefined}
      accessibilityLabel={accessibilityLabel} accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? "auto" : "no-hide-descendants"}>
      {staticOnly || failed ? (
        <Image source={config.poster} accessible={false} style={{ width: size, height: size }} />
      ) : (
        <Image source={config.atlas} accessible={false} fadeDuration={0} resizeMode="stretch"
          onLoad={() => setLoaded(true)} onError={() => { setFailed(true); onError?.(); }}
          style={{ position: "absolute", width: size * 16, height: size * config.rows,
            left: -(frame % 16) * size, top: -Math.floor(frame / 16) * size }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ viewport: { overflow: "hidden", direction: "ltr", flexShrink: 0 } });
