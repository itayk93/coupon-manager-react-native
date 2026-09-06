import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Image, StyleSheet, View } from "react-native";

const SHARING_SPRITE = require("../../../assets/mascot/sharing-offer-sprite.png");
const GRID_SIZE = 12;
const FRAME_COUNT = GRID_SIZE * GRID_SIZE;
const FRAME_DURATION = 70;

type MascotSpriteProps = {
  size?: number;
  accessibilityLabel: string;
};

/** Plays one square cell from a 12x12 sprite sheet at a time. */
export function MascotSprite({ size = 184, accessibilityLabel }: MascotSpriteProps) {
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
      style={[styles.stage, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <SpriteFrame frame={frame} size={size} />
    </View>
  );
}

function SpriteFrame({ frame, size }: { frame: number; size: number }) {
  const column = frame % GRID_SIZE;
  const row = Math.floor(frame / GRID_SIZE);
  const sheetSize = size * GRID_SIZE;

  return (
    <Image
      accessible={false}
      source={SHARING_SPRITE}
      resizeMode="stretch"
      style={{
        width: sheetSize,
        height: sheetSize,
        transform: [
          { translateX: -column * size },
          { translateY: -row * size },
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
