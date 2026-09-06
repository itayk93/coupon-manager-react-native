import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Image, StyleSheet, View } from "react-native";

const SHARING_SPRITE = require("../../../assets/mascot/sharing-offer-sprite.webp");
const GRID_SIZE = 4;
const FRAME_COUNT = GRID_SIZE * GRID_SIZE;
// Sheet cells are 256px. Keep the on-screen frame at or below that so the
// image is only ever downscaled (sharp), never upscaled (blurry).
const NATIVE_CELL = 256;
const FRAME_DURATION = 90;

type MascotSpriteProps = {
  size?: number;
  accessibilityLabel: string;
};

/** Plays one square cell from a 4x4 sprite sheet at a time. */
export function MascotSprite({ size = 156, accessibilityLabel }: MascotSpriteProps) {
  const cell = Math.min(size, NATIVE_CELL);
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
      resizeMode="cover"
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
