import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useReduceMotionSetting } from "@/hooks/useReduceMotion";
import { speechDuration, spokenSoFar } from "@/lib/speechPacing";
import { fonts } from "@/lib/theme";

/**
 * What Kuponi is saying.
 *
 * He only has a line when he has something to say about the user's money —
 * see `docs/mascot/STATE-LAW.md`. A screen that is merely busy gets a spinner,
 * not a bubble.
 *
 * Positioning belongs to the caller, but the tail is the part that decides
 * whether this reads as speech at all. Comics put the balloon above or beside
 * the speaker and point the tail down at their mouth; a balloon sitting under
 * a character with a tail pointing up at their feet is the shape of a caption,
 * which is what a label under a photograph is. `down` is the one to reach for
 * where he is saying the line. The look itself never varies, so he sounds like
 * the same character on every screen.
 *
 * `speak` is the other half of that: the line arrives a word at a time while
 * the character above plays his talking loop, and `onSpoken` tells the caller
 * when to put him back to rest. It is the pattern behind every character that
 * reads as speaking rather than captioned — an idle state and a speaking
 * state, with the length of the speech deciding when the second one ends,
 * which is exactly what Duolingo's rig does with a `isSpeaking` flag and a
 * duration taken from the audio. We have no audio and no mouth shapes to sync
 * to, so the words themselves are the timing: see `speechPacing.ts`.
 */
export function SpeechBubble({
  text,
  reduceMotion,
  tail = "none",
  isHeading = false,
  speak = false,
  onSpoken,
  style,
}: {
  text: string;
  /** Overrides the system setting; omit to follow it. */
  reduceMotion?: boolean;
  /** Which way the tail points: `down` at a character below, `up` at one above. */
  tail?: "up" | "down" | "none";
  /** True where the line is also the block's heading, as in an empty state. */
  isHeading?: boolean;
  /** True where a character above is saying this, rather than it being a label. */
  speak?: boolean;
  /** Fired once the last word is out, so the caller can stop his talking loop. */
  onSpoken?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const system = useReduceMotionSetting();
  const still = reduceMotion ?? system.reduced;
  // The reveal is a one-shot, so it waits for a real answer rather than acting
  // on the "assume reduced" placeholder and finishing before it hears back. A
  // prop is an answer in itself.
  const settled = reduceMotion !== undefined || system.known;

  const [progress, setProgress] = useState(1);
  const spoken = useRef(onSpoken);
  useEffect(() => { spoken.current = onSpoken; }, [onSpoken]);

  useEffect(() => {
    if (!speak) return;
    if (!settled) {
      setProgress(0);
      return;
    }
    if (still) {
      // Asked for no motion: the whole line at once, and he is done saying it
      // before he ever started, so he never sits in the talking loop.
      setProgress(1);
      spoken.current?.();
      return;
    }

    setProgress(0);
    const started = performance.now();
    const duration = speechDuration(text);
    // Follow elapsed time rather than counting ticks, the way `MascotAnimation`
    // does, so a busy thread drops words rather than stretching the line out
    // past the loop that is supposed to be saying it.
    const timer = setInterval(() => {
      const value = (performance.now() - started) / duration;
      if (value < 1) {
        setProgress(value);
        return;
      }
      clearInterval(timer);
      setProgress(1);
      spoken.current?.();
    }, 1000 / 30);
    return () => clearInterval(timer);
  }, [speak, settled, still, text]);

  const said = speak && progress < 1 ? spokenSoFar(text, progress) : text;

  return (
    // Keyed on the text so a new line animates in rather than swapping silently.
    <Animated.View
      key={text}
      // The line arrives from the direction he is in: rising off a character
      // below, settling down from one above. A bubble that drifts towards its
      // own speaker reads as a card being dealt onto the screen.
      entering={
        still ? undefined : (tail === "down" ? FadeInUp : FadeInDown).duration(240)
      }
      style={[styles.bubble, style]}
    >
      {tail === "up" ? <View style={styles.tail} /> : null}
      {tail === "down" ? <View style={styles.tailDown} /> : null}
      {speak ? (
        <View>
          {/* The finished line, invisible, holding the bubble at its final size:
              a bubble that grows a word at a time shoves the character above it
              around while he is mid-sentence. */}
          <Text
            style={[styles.text, styles.ghost]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {text}
          </Text>
          {/* The label is always the whole line: someone listening to the screen
              should not have to wait out an animation to hear the end of it. */}
          <Text
            accessibilityRole={isHeading ? "header" : undefined}
            accessibilityLabel={text}
            style={[styles.text, styles.said]}
          >
            {said}
          </Text>
        </View>
      ) : (
        <Text
          accessibilityRole={isHeading ? "header" : undefined}
          style={styles.text}
        >
          {text}
        </Text>
      )}
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
  // The same square at the other end, stroked on its two *lower* edges. Under
  // the 45° rotation the bottom and end edges are the ones facing down.
  tailDown: {
    position: "absolute",
    bottom: -6,
    alignSelf: "center",
    width: 11,
    height: 11,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderEndWidth: 1,
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
  ghost: {
    opacity: 0,
  },
  // `left`/`right` rather than `start`/`end`: these are not flipped by RTL, so
  // the overlay is the ghost's full width whichever way the layout runs.
  said: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});
