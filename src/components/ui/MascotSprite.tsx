import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Image, StyleSheet, View } from "react-native";
import { useNativeDriver } from "@/lib/animation";

const SHARING_SPRITE = require("../../../assets/mascot/sharing-offer-sprite.png");
const GRID_SIZE = 3;
const FRAME_COUNT = GRID_SIZE * GRID_SIZE;
const FRAME_HOLDS = [100, 45, 45, 55, 80, 55, 45, 65, 130];
const TRANSITION_DURATION = 130;

type MascotSpriteProps = {
  size?: number;
  accessibilityLabel: string;
};

/** Plays one square cell from a 3x3 sprite sheet at a time. */
export function MascotSprite({ size = 184, accessibilityLabel }: MascotSpriteProps) {
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
      Animated.delay(FRAME_HOLDS[frame]),
      Animated.timing(blend, {
        toValue: 1,
        duration: TRANSITION_DURATION,
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
      style={[styles.stage, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Animated.View style={[styles.frame, { opacity: Animated.subtract(1, blend) }]}>
        <SpriteFrame frame={frame} size={size} />
      </Animated.View>
      <Animated.View style={[styles.frame, { opacity: blend }]}>
        <SpriteFrame frame={nextFrame} size={size} />
      </Animated.View>
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
  frame: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
});
