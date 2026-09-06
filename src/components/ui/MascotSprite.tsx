import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Image, StyleSheet, View } from "react-native";

const SHARING_SPRITE = require("../../../assets/mascot/sharing-offer-sprite.webp");
const GRID_SIZE = 4;
const FRAME_COUNT = GRID_SIZE * GRID_SIZE;
// Sheet cells are 320px. The on-screen cell is always an exact integer fraction
// of that (320 / 160 / 80) so the browser only ever scales by a clean ratio —
// fractional scaling is what makes the sprite shimmer / "shake" between frames.
const NATIVE_CELL = 320;
const FRAME_DURATION = 115;

type MascotSpriteProps = {
  size?: number;
  accessibilityLabel: string;
};

/** Plays one square cell from a 4x4 sprite sheet at a time. */
export function MascotSprite({ size = 160, accessibilityLabel }: MascotSpriteProps) {
  const divisor = Math.min(4, Math.max(1, Math.round(NATIVE_CELL / size)));
  const cell = NATIVE_CELL / divisor;
  const [frame, setFrame] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const frameRef = useRef(0);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      frameRef.current = 0;
      setFrame(0);
      return;
    }
    const timer = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % FRAME_COUNT;
      setFrame(frameRef.current);
    }, FRAME_DURATION);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.stage, { width: cell, height: cell, borderRadius: cell / 2 }]}
    >
      <SpriteFrame frame={frame} cell={cell} />
    </View>
  );
}

function SpriteFrame({ frame, cell }: { frame: number; cell: number }) {
  const column = frame % GRID_SIZE;
  const row = Math.floor(frame / GRID_SIZE);
  const sheetSize = cell * GRID_SIZE;

  return (
    <Image
      accessible={false}
      source={SHARING_SPRITE}
      resizeMode="stretch"
      fadeDuration={0}
      style={{
        width: sheetSize,
        height: sheetSize,
        transform: [
          { translateX: -column * cell },
          { translateY: -row * cell },
        ],
      }}
    />
  );
}

const styles = StyleSheet.create({
  stage: {
    overflow: "hidden",
    backgroundColor: "rgba(231, 111, 81, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(231, 111, 81, 0.18)",
  },
});
