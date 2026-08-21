import React from "react";
import {
  View,
  Image,
  StyleSheet,
  Animated,
  ImageSourcePropType,
  ImageStyle,
  ViewStyle,
  StyleProp,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTiltValue } from "@/hooks/useTilt";

const MAX_TILT_DEG = 35;
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

type ShimmerLogoProps = {
  source: ImageSourcePropType;
  /** Size of the square logo frame, used to scale the sheen. */
  size: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

/**
 * A company logo with a sheen that slides across it as the phone is tilted,
 * the way light moves over a foil-stamped gift card. Falls back to a static
 * logo wherever there is no motion sensor.
 */
export function ShimmerLogo({
  source,
  size,
  style,
  imageStyle,
}: ShimmerLogoProps) {
  const { roll, active } = useTiltValue();

  const travel = size * 1.3;
  const slide = roll.interpolate({
    inputRange: [-MAX_TILT_DEG, MAX_TILT_DEG],
    outputRange: [-travel, travel],
    extrapolate: "clamp",
  });

  // The sheen is brightest when the phone is roughly level with the light,
  // and stays subtle throughout — it should read as a hint of gloss, not a
  // white bar crossing the logo.
  const opacity = roll.interpolate({
    inputRange: [-MAX_TILT_DEG, -10, 0, 10, MAX_TILT_DEG],
    outputRange: [0.06, 0.3, 0.38, 0.3, 0.06],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.frame, style]}>
      <Image
        source={source}
        style={[styles.logo, imageStyle]}
        resizeMode="contain"
      />

      {active ? (
        <AnimatedGradient
          pointerEvents="none"
          colors={[
            "rgba(255,255,255,0)",
            "rgba(255,255,255,0.55)",
            "rgba(255,255,255,0.85)",
            "rgba(255,255,255,0.55)",
            "rgba(255,255,255,0)",
          ]}
          locations={[0, 0.35, 0.5, 0.65, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.sheen,
            {
              width: size * 1.15,
              height: size * 2.4,
              opacity,
              transform: [{ rotate: "22deg" }, { translateX: slide }],
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: "74%",
    height: "74%",
  },
  sheen: {
    position: "absolute",
  },
});
