import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Image, StyleSheet, View } from "react-native";

const SHARING_SPRITE = require("../../../assets/mascot/sharing-offer-sprite.png");
const GRID_SIZE = 3;
const FRAME_COUNT = GRID_SIZE * GRID_SIZE;
const FRAME_DELAYS = [220, 100, 100, 110, 150, 110, 100, 120, 260];

type MascotSpriteProps = {
  size?: number;
  accessibilityLabel: string;
};

/** Plays one square cell from a 3x3 sprite sheet at a time. */
export function MascotSprite({ size = 184, accessibilityLabel }: MascotSpriteProps) {
  const [frame, setFrame] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

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
      setFrame(0);
      return;
    }
    const timer = setTimeout(
      () => setFrame((current) => (current + 1) % FRAME_COUNT),
      FRAME_DELAYS[frame],
    );
    return () => clearTimeout(timer);
  }, [frame, reduceMotion]);

  const column = frame % GRID_SIZE;
  const row = Math.floor(frame / GRID_SIZE);
  const sheetSize = size * GRID_SIZE;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.stage, { width: size, height: size, borderRadius: size / 2 }]}
    >
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
    </View>
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
