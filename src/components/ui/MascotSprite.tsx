import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from "react-native";
import { useNativeDriver } from "@/lib/animation";

const SHARING_SPRITE = require("../../../assets/mascot/sharing-offer-sprite.webp");
const GRID_SIZE = 12;
const FRAME_COUNT = GRID_SIZE * GRID_SIZE;
// Sheet cells are 160px. Keep the on-screen frame at or below that so the
// image is only ever downscaled (sharp), never upscaled (blurry).
const NATIVE_CELL = 160;
const FRAME_HOLD = 90;
const CROSSFADE = 70;

type MascotSpriteProps = {
  size?: number;
  accessibilityLabel: string;
};

/** Plays one square cell from a 12x12 sprite sheet, cross-fading between frames. */
export function MascotSprite({ size = 148, accessibilityLabel }: MascotSpriteProps) {
  const cell = Math.min(size, NATIVE_CELL);
  const [frame, setFrame] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const blend = useRef(new Animated.Value(0)).current;

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
      blend.stopAnimation();
      blend.setValue(0);
      setFrame(0);
      return;
    }
    const nextFrame = (frame + 1) % FRAME_COUNT;
    blend.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(FRAME_HOLD),
      Animated.timing(blend, {
        toValue: 1,
        duration: CROSSFADE,
        easing: Easing.linear,
        useNativeDriver,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) setFrame(nextFrame);
    });
    return () => animation.stop();
  }, [blend, frame, reduceMotion]);

  const nextFrame = (frame + 1) % FRAME_COUNT;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.stage, { width: cell, height: cell, borderRadius: cell / 2 }]}
    >
      <Animated.View style={[styles.frame, { opacity: Animated.subtract(1, blend) }]}>
        <SpriteFrame frame={frame} cell={cell} />
      </Animated.View>
      <Animated.View style={[styles.frame, { opacity: blend }]}>
        <SpriteFrame frame={nextFrame} cell={cell} />
      </Animated.View>
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
  frame: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
});
