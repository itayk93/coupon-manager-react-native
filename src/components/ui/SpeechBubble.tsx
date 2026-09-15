import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { fonts } from "@/lib/theme";

/**
 * What Kuponi is saying.
 *
 * He only has a line when he has something to say about the user's money —
 * see `docs/mascot/STATE-LAW.md`. A screen that is merely busy gets a spinner,
 * not a bubble.
 *
 * Positioning belongs to the caller: the onboarding floats one over an
 * illustration, everywhere else stacks one under him with a tail pointing up.
 * The look itself never varies, so he sounds like the same character on every
 * screen.
 */
export function SpeechBubble({
  text,
  reduceMotion,
  tail = "none",
  isHeading = false,
  style,
}: {
  text: string;
  /** Overrides the system setting; omit to follow it. */
  reduceMotion?: boolean;
  /** `up` points the bubble at a character sitting above it. */
  tail?: "up" | "none";
  /** True where the line is also the block's heading, as in an empty state. */
  isHeading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const systemReduced = useReduceMotion();
  const still = reduceMotion ?? systemReduced;
  return (
    // Keyed on the text so a new line animates in rather than swapping silently.
    <Animated.View
      key={text}
      entering={still ? undefined : FadeInDown.duration(240)}
      style={[styles.bubble, style]}
    >
      {tail === "up" ? <View style={styles.tail} /> : null}
      <Text
        accessibilityRole={isHeading ? "header" : undefined}
        style={styles.text}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

/** The blue-tinted border is the bubble's signature; it reads as his. */
const BORDER = "#CFE0FF";

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "100%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    boxShadow: "0px 0px 8px rgba(23, 32, 51, 0.08)",
    elevation: 2,
  },
  // A rotated square with only its two upper edges stroked: the bubble's own
  // background covers the rest, so the tail reads as part of the same shape.
  tail: {
    position: "absolute",
    top: -6,
    alignSelf: "center",
    width: 11,
    height: 11,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderStartWidth: 1,
    borderColor: BORDER,
    transform: [{ rotate: "45deg" }],
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    lineHeight: 19,
    color: "#263246",
    textAlign: "right",
    writingDirection: "rtl",
  },
});
