import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
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
 * The balloon is drawn the way comic lettering draws one: paper, a heavy ink
 * outline, a generous corner radius, and a tapered spike for a tail. It used
 * to be a hairline blue rounded rectangle with a small rotated square hanging
 * off it, which is the shape of a tooltip — a UI affordance pointing at a
 * control — and a tooltip is a thing the interface says, not a thing a
 * character says. The ink is the same navy the lettering is set in, so the
 * outline reads as drawn rather than as a border.
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
      {tail === "none" ? null : <Tail direction={tail} />}
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

/** The ink everything is drawn in — outline and lettering both, which is what
 *  makes the balloon read as one drawing rather than a bordered box. */
const INK = "#1F2A3C";
const PAPER = "#fff";
const STROKE = 2;

/** The spike, and the transparent margin the SVG needs so neither the stroke —
 *  centred on the path, so half of it lies outside — nor the paper that reaches
 *  back into the balloon is clipped by its own viewport. */
const TAIL = { width: 24, height: 16, pad: 3 };
const TAIL_BOX = { width: TAIL.width + TAIL.pad * 2, height: TAIL.height + TAIL.pad * 2 };

/**
 * How far the tip hangs past the balloon's edge.
 *
 * Exported because the caller is the one placing the character, and the gap it
 * leaves him is only right relative to this: see `HEAD_GAP` in `AtRiskScreen`.
 * A tail is supposed to close most of the distance to the speaker, and "most"
 * is not a number anyone can keep in sync by hand.
 */
export const SPEECH_TAIL_DROP = TAIL.height - STROKE / 2;

/**
 * The gap to leave between the balloon and the character it is pointing at.
 *
 * The tail spends `SPEECH_TAIL_DROP` of it and the last few points stay empty:
 * a tail is meant to reach for the speaker's mouth and stop short of it, and
 * one that lands *on* the drawing reads as a skewer. Every caller with a tail
 * owes the character this much room, so it is one number here rather than a 10
 * copied into five stylesheets — which is what it was, and why growing the
 * spike would otherwise have put it through four characters at once.
 */
export const SPEECH_TAIL_CLEARANCE = SPEECH_TAIL_DROP + 5;

/**
 * Where the tail's base sits: on the centre line of the balloon's own outline,
 * so a 2pt stroke leaving the spike and a 2pt border arriving along the balloon
 * are the same 2pt of ink and meet without a step.
 *
 * An absolutely positioned child is placed from its parent's *padding* box, on
 * the inside of the border — so this has to carry the half-border itself. The
 * first attempt left it out, and the tail hung two points high: its outline
 * started inside the paper, with a notch of ink showing on either side of it.
 */
const TAIL_OFFSET = TAIL.height + TAIL.pad + STROKE / 2;

/**
 * The tail, as a drawing rather than a rotated square.
 *
 * The sides are pulled slightly concave, which is the whole difference between
 * a spike a letterer would draw and a triangle a CSS border produces: the
 * taper gives the eye a direction to follow down to the speaker.
 *
 * It is a path because the shape needs a stroke on its two slanted edges and
 * none at all across its base — the base sits inside the balloon, where the
 * outline has to stop so the two read as one shape. Filling the closed
 * polygon first is what erases the balloon's own outline behind it; the open
 * path stroked on top then carries the outline out to the tip and back.
 */
function Tail({ direction }: { direction: "up" | "down" }) {
  const { width, height, pad } = TAIL;
  const down = direction === "down";
  // The base lies against the balloon, the tip points away from it, so `up` is
  // the same spike flipped and both directions taper identically.
  const baseY = down ? pad : pad + height;
  const tipY = down ? pad + height : pad;
  const [left, right, tipX] = [pad, pad + width, pad + width / 2];
  // Shallow control points: the sides stay full most of the way down and only
  // give at the end. Pulling them harder produced an arrowhead — a thin V that
  // points rather than a spike that tapers.
  const bendY = baseY + (tipY - baseY) * 0.45;
  const bend = width * 0.13;
  // Down one side to the tip and back up the other, from base corner to base
  // corner. Both paths below are this plus a different way in and out of it.
  const sides =
    `Q ${right - bend} ${bendY} ${tipX} ${tipY} Q ${left + bend} ${bendY} ${left} ${baseY}`;
  const edges = `M ${right} ${baseY} ${sides}`;
  // The paper reaches a full stroke back past the base, into the balloon, so it
  // takes out the whole width of the border behind the tail's mouth. Stopping
  // at the base would leave the outline's far half ruled across the opening.
  const paperY = down ? baseY - STROKE : baseY + STROKE;
  const paper = `M ${left} ${paperY} L ${right} ${paperY} L ${right} ${baseY} ${sides} Z`;

  return (
    <Svg
      width={TAIL_BOX.width}
      height={TAIL_BOX.height}
      viewBox={`0 0 ${TAIL_BOX.width} ${TAIL_BOX.height}`}
      style={down ? styles.tailDown : styles.tailUp}
    >
      <Path d={paper} fill={PAPER} />
      <Path
        d={edges}
        fill="none"
        stroke={INK}
        strokeWidth={STROKE}
        // Butt caps rather than round: a round cap at the base would bulge a
        // point of ink into the balloon's paper, just inside the outline.
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "100%",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: PAPER,
    borderWidth: STROKE,
    borderColor: INK,
    // Offset down and barely blurred: a printed drop shadow, not a glow.
    boxShadow: "0px 2px 6px rgba(23, 32, 51, 0.10)",
    elevation: 2,
  },
  tailUp: {
    position: "absolute",
    top: -TAIL_OFFSET,
    alignSelf: "center",
  },
  tailDown: {
    position: "absolute",
    bottom: -TAIL_OFFSET,
    alignSelf: "center",
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    lineHeight: 19,
    color: INK,
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
