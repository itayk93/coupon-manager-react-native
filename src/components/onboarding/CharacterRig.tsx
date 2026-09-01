import React, { useEffect, useRef } from "react";
import { Animated as NativeAnimated, Dimensions, Easing as NativeEasing, PanResponder, StyleSheet, View } from "react-native";
import Animated, { Easing, cancelAnimation, interpolate, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";

/**
 * The walkthrough cast, rigged rather than rendered.
 *
 * The characters used to be flat PNG cut-outs slid up and down, which reads as
 * a picture being moved, not a character being alive. Everything here is built
 * from views the animation can actually deform: bodies squash and stretch into
 * a hop, eyes blink on their own clock and look where the moment points, the
 * investigator's glass sweeps the card while the parser thinks, and the helper
 * waves from the shoulder.
 *
 * Views, not SVG: `borderRadius` gives exact circles and capsules, and
 * `transformOrigin` gives real pivots, so a limb rotates from its shoulder
 * without the translate-rotate-translate dance. Reanimated drives all of it on
 * the UI thread — no bridge traffic per frame.
 *
 * Colors are fixed by the character sheet (assets/onboarding/CHARACTERS.md):
 * blue stays #2864F0, mint stays #58DFC6.
 */

export type CharacterState = "talking" | "thinking" | "cheering" | "scanning" | "success";

const BLUE = "#2864F0";
const BLUE_DARK = "#1B47B4";
const BLUE_LIGHT = "#93B4FF";
const MINT = "#58DFC6";
const MINT_DARK = "#2FB49B";
const MINT_LIGHT = "#BFF3E9";
const INK = "#16233A";

/** Bubble tints behind a lone character, matched to the card it sits on. */
const BUBBLE = {
  mint: "rgba(88, 223, 198, 0.16)",
  blue: "rgba(40, 100, 240, 0.12)",
  success: "rgba(22, 163, 74, 0.12)",
  coral: "rgba(231, 111, 81, 0.14)",
  none: "transparent",
} as const;

/** Whether the state is a one-shot reaction rather than a loop. */
function isCelebration(state: CharacterState) {
  return state === "cheering" || state === "success";
}

/**
 * A free-running 0→1 clock, shared by every idle loop in a scene.
 *
 * One clock keeps the two characters in a fixed phase relationship instead of
 * drifting apart, and each part reads it through its own interpolation, so a
 * bob, a sway and a breath can all differ without three separate timers.
 */
function useClock(active: boolean, period: number) {
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(clock);
      clock.value = 0;
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [active, clock, period]);
  return clock;
}

/** An eye-blink loop, offset so two characters never blink in lockstep. */
function useBlink(active: boolean, offset: number) {
  const open = useSharedValue(1);
  useEffect(() => {
    if (!active) {
      cancelAnimation(open);
      open.value = 1;
      return;
    }
    open.value = withDelay(offset, withRepeat(withSequence(
      withTiming(1, { duration: 2100 }),
      withTiming(0.06, { duration: 70 }),
      withTiming(1, { duration: 90 }),
      // A second, quicker blink now and then: a perfectly even blink rate is
      // the tell that something is on a timer rather than alive.
      withTiming(1, { duration: 1500 }),
      withTiming(0.06, { duration: 60 }),
      withTiming(1, { duration: 80 }),
    ), -1, false));
    return () => cancelAnimation(open);
  }, [active, offset, open]);
  return open;
}

/**
 * The Worklets display-link queue aborts on some iOS 26 ProMotion devices.
 * Keep the detailed rig in its stable pose and animate the whole character
 * through React Native's native animation driver instead.
 */
function useSafeMascotMotion(active: boolean, period = 1700) {
  const progress = useRef(new NativeAnimated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }

    const animation = NativeAnimated.loop(
      NativeAnimated.sequence([
        NativeAnimated.timing(progress, {
          toValue: 1,
          duration: period / 2,
          easing: NativeEasing.inOut(NativeEasing.ease),
          useNativeDriver: true,
        }),
        NativeAnimated.timing(progress, {
          toValue: 0,
          duration: period / 2,
          easing: NativeEasing.inOut(NativeEasing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [active, period, progress]);

  return {
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
      { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["-1deg", "1deg"] }) },
    ],
  };
}

/**
 * Baby-schema face: oversized eyes, a double glint, high blush and a smile.
 * The old rig gave the investigator a flat bar for a mouth, which reads as
 * glum at small sizes — every cast member smiles now.
 */
function StaticFace({ blush = INK, blink }: { blush?: string; blink?: NativeAnimated.Value }) {
  const lidStyle = blink ? { transform: [{ scaleY: blink }] } : undefined;
  return <>
    <View style={styles.face}>
      <NativeAnimated.View style={[styles.eye, lidStyle]}>
        <View style={styles.pupil}><View style={styles.glint} /><View style={styles.glintSmall} /></View>
      </NativeAnimated.View>
      <NativeAnimated.View style={[styles.eye, lidStyle]}>
        <View style={styles.pupil}><View style={styles.glint} /><View style={styles.glintSmall} /></View>
      </NativeAnimated.View>
    </View>
    <View style={[styles.blush, styles.blushLeft, { backgroundColor: blush }]} />
    <View style={[styles.blush, styles.blushRight, { backgroundColor: blush }]} />
    <View style={styles.smile} />
  </>;
}

/** Blink on the native driver, for the rig that cannot run worklets. */
function useSafeBlink(active: boolean, offset = 0) {
  const open = useRef(new NativeAnimated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      open.stopAnimation();
      open.setValue(1);
      return;
    }
    const shut = (d: number) => NativeAnimated.timing(open, { toValue: 0.08, duration: d, useNativeDriver: true });
    const opened = (d: number) => NativeAnimated.timing(open, { toValue: 1, duration: d, useNativeDriver: true });
    // Uneven spacing — a metronome blink is the tell that nothing is alive.
    const loop = NativeAnimated.loop(NativeAnimated.sequence([
      NativeAnimated.delay(2000 + offset),
      shut(70), opened(90),
      NativeAnimated.delay(220),
      shut(60), opened(80),
      NativeAnimated.delay(1700),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, offset, open]);
  return open;
}

function SafeInvestigator({ animate = true }: { animate?: boolean }) {
  const blink = useSafeBlink(animate, 0);
  return <View style={[styles.slot, styles.slotFront]}>
    <View style={styles.shadow} />
    <View style={styles.bodyAnchor}>
      <View style={[styles.body, styles.bodyBlue]}>
        <View style={[styles.cap, { backgroundColor: BLUE_DARK }]} />
        <View style={[styles.capBrim, { backgroundColor: BLUE_DARK }]} />
        <View style={[styles.belly, { backgroundColor: BLUE_LIGHT }]} />
        <StaticFace blush={BLUE_DARK} blink={blink} />
      </View>
      <View style={[styles.arm, styles.armRight, { backgroundColor: BLUE_DARK, transform: [{ rotate: "20deg" }] }]}>
        <View style={styles.magnifier}>
          <View style={styles.magnifierLens} />
          <View style={styles.magnifierGlint} />
        </View>
      </View>
    </View>
  </View>;
}

function SafeHelper({ animate = true }: { animate?: boolean }) {
  const blink = useSafeBlink(animate, 900);
  return <View style={styles.slot}>
    <View style={styles.shadow} />
    <View style={styles.bodyAnchor}>
      <View style={[styles.body, styles.bodyMint]}>
        <View style={[styles.antenna, { backgroundColor: MINT_DARK }]} />
        <View style={[styles.antennaTip, { backgroundColor: MINT_LIGHT }]} />
        <View style={[styles.belly, { backgroundColor: MINT_LIGHT }]} />
        <StaticFace blush={MINT_DARK} blink={blink} />
      </View>
      <View style={[styles.arm, styles.armLeft, { backgroundColor: MINT_DARK, transform: [{ rotate: "-35deg" }] }]}>
        <View style={[styles.hand, { backgroundColor: MINT_DARK }]} />
      </View>
    </View>
  </View>;
}

function SafeCoupon() {
  return <View style={styles.card}>
    <View style={[styles.cardLine, { width: 40 }]} />
    <View style={[styles.cardLine, { width: 26 }]} />
    <View style={styles.cardChip} />
  </View>;
}

export function CharacterScene({ state, reduceMotion, compact }: { state: CharacterState; reduceMotion?: boolean; compact?: boolean }) {
  const systemReducedMotion = useReducedMotion();
  const shouldAnimate = !(reduceMotion ?? systemReducedMotion);
  const safeMotionStyle = useSafeMascotMotion(shouldAnimate, state === "scanning" ? 1050 : 1700);
  const scale = compact ? 0.82 : 1;
  return <View style={styles.scene}>
    <NativeAnimated.View style={safeMotionStyle}>
      <View style={[styles.cast, { transform: [{ scale }] }]}>
        <SafeInvestigator />
        <SafeCoupon />
        <SafeHelper />
      </View>
    </NativeAnimated.View>
  </View>;
}

/** One cast member for product empty/loading states. Keeps regular screens quiet. */
export function CharacterSpotlight({
  character,
  state = "talking",
  reduceMotion,
  size = "medium",
  tone = "mint",
}: {
  character: "investigator" | "helper";
  state?: CharacterState;
  reduceMotion?: boolean;
  size?: "small" | "medium" | "large";
  /** Tint of the bubble behind the character, so it sits on its host card. */
  tone?: "mint" | "blue" | "success" | "coral" | "none";
}) {
  const systemReducedMotion = useReducedMotion();
  const shouldAnimate = !(reduceMotion ?? systemReducedMotion);
  const safeMotionStyle = useSafeMascotMotion(shouldAnimate, state === "scanning" ? 950 : 1600);
  const box = size === "small" ? 88 : size === "large" ? 176 : 132;
  // The rig is SLOT_H tall; derive the scale from the bubble instead of
  // hard-coding it, so the character sits inside the disc rather than
  // spilling out of the top of it (which is what made the small size look
  // like a cropped sticker).
  const scale = (box * 0.92) / SLOT_H;
  // The investigator artwork has more transparent space below than above, so
  // geometric centering makes the hat hug the top edge. Nudge the artwork —
  // not the bubble — down just enough to balance the visible silhouette.
  const artworkOffsetY = Math.min(8, box * 0.08);
  // `tone: "none"` means the character is sitting directly on a host surface,
  // so the ring and the gloss go too. Keeping them draws a pale disc on the
  // banner's own colour and the mascot reads as a sticker.
  const bare = tone === "none";
  const ring = bare
    ? "transparent"
    : tone === "coral"
      ? "rgba(231, 111, 81, 0.32)"
    : character === "investigator"
      ? "rgba(40, 100, 240, 0.18)"
      : "rgba(88, 223, 198, 0.28)";
  return (
    <View
      style={[
        styles.spotlight,
        {
          width: box,
          height: box,
          borderRadius: box / 2,
          backgroundColor: BUBBLE[tone],
          borderColor: ring,
          pointerEvents: "none",
        },
      ]}
      accessibilityElementsHidden
    >
      {bare ? null : <View style={[styles.spotlightGloss, { borderRadius: box / 2 }]} />}
      <NativeAnimated.View style={[styles.spotlightBody, safeMotionStyle, { transform: [...safeMotionStyle.transform, { translateY: artworkOffsetY }, { scale }] }]}>
        {character === "investigator" ? (
          <SafeInvestigator animate={shouldAnimate} />
        ) : (
          <SafeHelper animate={shouldAnimate} />
        )}
      </NativeAnimated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Floating mascot — no disc, drag it anywhere.
 * ------------------------------------------------------------------ */

/**
 * The mascot as a free-floating overlay the user can drag with a finger.
 *
 * The bubble is gone: a tinted disc behind the character ate list width and
 * read as a placeholder avatar. This one sits above the content with nothing
 * behind it, so the only thing on screen is the character.
 *
 * The drag is a plain PanResponder over an `Animated.ValueXY` on the native
 * driver — no gesture-handler dependency, and the pointer stays glued to the
 * mascot because the offset is flattened on release rather than reset.
 */
export function FloatingMascot({
  character = "investigator",
  size = 88,
  initial,
  bottomInset = 8,
  leftInset = EDGE_GUARD,
  reduceMotion,
}: {
  character?: "investigator" | "helper";
  /** Rendered height in points; the rig scales to fit it. */
  size?: number;
  /** Starting offset from the resting spot, in points. */
  initial?: { x: number; y: number };
  /** Gap kept above the tab bar at rest. */
  bottomInset?: number;
  /** Gap kept from the left edge at rest. */
  leftInset?: number;
  reduceMotion?: boolean;
}) {
  const systemReducedMotion = useReducedMotion();
  const shouldAnimate = !(reduceMotion ?? systemReducedMotion);
  const idleStyle = useSafeMascotMotion(shouldAnimate);
  const scale = size / SLOT_H;
  const width = 92 * scale;

  const screen = Dimensions.get("window");
  // The mascot rests bottom-left, just above the tab bar; anchoring the view
  // there and dragging from {0,0} keeps the resting spot correct on every
  // screen height instead of computing a top offset that drifts per device.
  const start = initial ?? { x: 0, y: 0 };
  const pan = useRef(new NativeAnimated.ValueXY(start)).current;
  const position = useRef({ ...start });
  const grabbed = useRef(new NativeAnimated.Value(0)).current;
  const tilt = useRef(new NativeAnimated.Value(0)).current;

  useEffect(() => {
    const id = pan.addListener((value) => { position.current = value; });
    return () => pan.removeListener(id);
  }, [pan]);

  const responder = useRef(
    PanResponder.create({
      // Claim the gesture only once it is a real drag, so a scroll that starts
      // on the mascot still scrolls the list underneath.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        pan.setOffset({ ...position.current });
        pan.setValue({ x: 0, y: 0 });
        NativeAnimated.spring(grabbed, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
      },
      // Written out rather than through `Animated.event` so the same handler
      // can drive the tilt: lean into the direction of travel. A body that
      // translates without rotating reads as a cursor dragging an image; the
      // tilt is what makes it read as weight being pulled along.
      onPanResponderMove: (_e, g) => {
        pan.setValue({ x: g.dx, y: g.dy });
        tilt.setValue(Math.max(-14, Math.min(14, g.vx * 9)));
      },
      onPanResponderRelease: (_e, g) => {
        pan.flattenOffset();
        NativeAnimated.spring(grabbed, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
        NativeAnimated.spring(tilt, { toValue: 0, useNativeDriver: true, friction: 4, tension: 90 }).start();

        // Offsets are relative to the bottom-left rest spot: x grows right,
        // y grows down, so the reachable box is x >= 0 and y <= 0.
        const maxX = Math.max(0, screen.width - width - leftInset - 8);
        // x >= 0 already keeps it out of the back-gesture strip, since the
        // rest spot sits at leftInset.
        const minY = -Math.max(0, screen.height - size - 160);
        const settle = () => {
          // A mascot flung past the bezel can never be dragged back, so it
          // always ends inside the reachable box.
          const x = Math.min(Math.max(position.current.x, 0), maxX);
          const y = Math.min(Math.max(position.current.y, minY), 0);
          if (x === position.current.x && y === position.current.y) return;
          NativeAnimated.spring(pan, { toValue: { x, y }, useNativeDriver: false, friction: 6, tension: 70 }).start();
        };

        // Carry the throw: `decay` keeps the release velocity and bleeds it off,
        // instead of the mascot stopping dead the instant the finger lifts.
        const flick = NativeAnimated.decay(pan, {
          velocity: { x: g.vx, y: g.vy },
          deceleration: 0.994,
          useNativeDriver: false,
        });
        // Cut the slide short the moment it leaves the box, then spring back —
        // letting decay run to a stop first would send it far off screen and
        // make the return trip feel like a separate animation.
        const guard = pan.addListener(({ x, y }) => {
          if (x < -24 || x > maxX + 24 || y > 24 || y < minY - 24) {
            flick.stop();
          }
        });
        flick.start(() => {
          pan.removeListener(guard);
          settle();
        });
      },
    })
  ).current;

  const liftStyle = {
    transform: [
      { scale: grabbed.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) },
      { rotate: tilt.interpolate({ inputRange: [-14, 14], outputRange: ["14deg", "-14deg"] }) },
    ],
  };

  return (
    <NativeAnimated.View
      {...responder.panHandlers}
      // A rig is mostly round, so its corners are dead space; the slop gives
      // back the points a finger aims at but misses.
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityElementsHidden
      style={[styles.floating, { width, height: size, left: leftInset, bottom: bottomInset, transform: pan.getTranslateTransform() }]}
    >
      <NativeAnimated.View style={liftStyle}>
        <NativeAnimated.View style={[styles.floatingBody, idleStyle, { transform: [...idleStyle.transform, { scale }] }]}>
          {character === "investigator" ? <SafeInvestigator animate={shouldAnimate} /> : <SafeHelper animate={shouldAnimate} />}
        </NativeAnimated.View>
      </NativeAnimated.View>
    </NativeAnimated.View>
  );
}

/** Bubble fills behind a single character. Kept low-contrast so the mascot,
 *  not the disc, is what the eye lands on. */
const TONES: Record<"mint" | "blue" | "success" | "plain", string> = {
  mint: "rgba(88, 223, 198, 0.12)",
  blue: "rgba(40, 100, 240, 0.10)",
  success: "rgba(22, 163, 74, 0.10)",
  plain: "transparent",
};

/* ------------------------------------------------------------------ *
 * Blue investigator — leans in, and sweeps the glass while we parse.
 * ------------------------------------------------------------------ */

function BlueInvestigator({ state, reduceMotion }: { state: CharacterState; reduceMotion: boolean }) {
  const idle = !reduceMotion && !isCelebration(state);
  const clock = useClock(idle, state === "scanning" ? 1100 : state === "thinking" ? 2600 : 1900);
  const blink = useBlink(!reduceMotion, 400);

  const hop = useSharedValue(0);      // 0 grounded, 1 at the top of a jump
  const squash = useSharedValue(0);   // 0 neutral, 1 fully compressed
  const lean = useSharedValue(0);     // degrees toward the card
  const glass = useSharedValue(0);    // sweep progress across the card

  useEffect(() => {
    if (reduceMotion) {
      hop.value = 0; squash.value = 0; lean.value = state === "scanning" ? 8 : 0; glass.value = 0.5;
      return;
    }
    if (isCelebration(state)) {
      // Anticipation, launch, landing — the squash before the jump is what
      // sells it; a body that simply rises reads as an elevator.
      squash.value = withSequence(withTiming(1, { duration: 130 }), withTiming(0, { duration: 120 }), withDelay(240, withTiming(0.7, { duration: 90 })), withSpring(0, { damping: 7 }));
      hop.value = withSequence(withDelay(130, withSpring(1, { damping: 9, stiffness: 190 })), withSpring(0, { damping: 12, stiffness: 170 }));
      lean.value = withSequence(withSpring(-9), withSpring(0));
      glass.value = withSpring(0.5);
      return;
    }
    lean.value = withSpring(state === "scanning" ? 9 : state === "thinking" ? -5 : 0, { damping: 14 });
    hop.value = 0; squash.value = 0;
    if (state === "scanning") {
      glass.value = withRepeat(withSequence(
        withTiming(1, { duration: 780, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 780, easing: Easing.inOut(Easing.cubic) }),
      ), -1, false);
    } else {
      cancelAnimation(glass);
      glass.value = withSpring(0.5);
    }
  }, [glass, hop, lean, reduceMotion, squash, state]);

  // The bob and the breath both come off the shared clock, a quarter-cycle
  // apart, so the body rises as the chest settles instead of pulsing as one.
  const bob = useDerivedValue(() => Math.sin(clock.value * Math.PI * 2) * (state === "scanning" ? 2.5 : 4));
  const breath = useDerivedValue(() => Math.sin(clock.value * Math.PI * 2 - Math.PI / 2) * 0.018);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value - hop.value * 26 },
      { rotate: `${lean.value}deg` },
      // Squash and stretch conserve volume: as the body flattens it widens by
      // the same proportion, which is what keeps it feeling like mass.
      { scaleY: 1 + breath.value - squash.value * 0.2 + hop.value * 0.09 },
      { scaleX: 1 - breath.value + squash.value * 0.18 - hop.value * 0.06 },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.2 - hop.value * 0.11,
    transform: [{ scaleX: 1 - hop.value * 0.3 + squash.value * 0.12 }],
  }));

  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));

  // The pupils track the glass on a scan and drift up while thinking — the
  // cheapest signal that attention is going somewhere.
  const pupilStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: state === "scanning" ? interpolate(glass.value, [0, 1], [2, -3]) : state === "thinking" ? -2.5 : 0 },
      { translateY: state === "thinking" ? -2 : 0.5 },
    ],
  }));

  // The arm hangs on the investigator's right, toward the card, so positive
  // degrees swing the glass out over it and negative degrees raise it overhead.
  const armStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${state === "scanning" ? interpolate(glass.value, [0, 1], [14, 44]) : isCelebration(state) ? -120 + hop.value * -35 : 10}deg` }],
  }));

  const glassStyle = useAnimatedStyle(() => ({
    transform: [{ scale: state === "scanning" ? interpolate(glass.value, [0, 0.5, 1], [1, 1.12, 1]) : 1 }],
  }));

  const mouthStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: isCelebration(state) ? 1.9 : state === "talking" ? interpolate(clock.value, [0, 0.25, 0.5, 0.75, 1], [0.5, 1.5, 0.7, 1.3, 0.5]) : 0.7 },
      { scaleX: isCelebration(state) ? 1.15 : 1 },
    ],
  }));

  return <View style={[styles.slot, styles.slotFront]}>
    <Animated.View style={[styles.shadow, shadowStyle]} />
    <Animated.View style={[styles.bodyAnchor, bodyStyle]}>
      <View style={[styles.body, styles.bodyBlue]}>
        <View style={[styles.cap, { backgroundColor: BLUE_DARK }]} />
        <View style={[styles.capBrim, { backgroundColor: BLUE_DARK }]} />
        <View style={[styles.belly, { backgroundColor: BLUE_LIGHT }]} />
        <View style={styles.face}>
          <Animated.View style={[styles.eye, eyeStyle]}><Animated.View style={[styles.pupil, pupilStyle]}><View style={styles.glint} /></Animated.View></Animated.View>
          <Animated.View style={[styles.eye, eyeStyle]}><Animated.View style={[styles.pupil, pupilStyle]}><View style={styles.glint} /></Animated.View></Animated.View>
        </View>
        <View style={[styles.blush, styles.blushLeft, { backgroundColor: BLUE_DARK }]} />
        <View style={[styles.blush, styles.blushRight, { backgroundColor: BLUE_DARK }]} />
        <Animated.View style={[styles.mouth, mouthStyle]} />
      </View>
      <Animated.View style={[styles.arm, styles.armRight, { backgroundColor: BLUE_DARK }, armStyle]}>
        <Animated.View style={[styles.magnifier, glassStyle]}>
          <View style={styles.magnifierLens} />
          <View style={styles.magnifierGlint} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  </View>;
}

/* ------------------------------------------------------------------ *
 * Mint helper — waves, points, and celebrates.
 * ------------------------------------------------------------------ */

function MintHelper({ state, reduceMotion }: { state: CharacterState; reduceMotion: boolean }) {
  const idle = !reduceMotion && !isCelebration(state);
  const clock = useClock(idle, state === "talking" ? 1500 : 2200);
  const blink = useBlink(!reduceMotion, 1300);

  const hop = useSharedValue(0);
  const squash = useSharedValue(0);
  const wave = useSharedValue(0);
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) { hop.value = 0; squash.value = 0; wave.value = 0; tilt.value = 0; return; }
    if (isCelebration(state)) {
      squash.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 110 }), withDelay(260, withTiming(0.8, { duration: 90 })), withSpring(0, { damping: 6 }));
      // Two hops, the second smaller — a single jump reads as a bounce, two
      // read as delight.
      hop.value = withSequence(withDelay(120, withSpring(1, { damping: 8, stiffness: 210 })), withSpring(0, { damping: 11 }), withSpring(0.5, { damping: 9 }), withSpring(0, { damping: 13 }));
      wave.value = withRepeat(withSequence(withTiming(1, { duration: 170 }), withTiming(0, { duration: 170 })), 6, false);
      tilt.value = withSequence(withSpring(7), withSpring(-4), withSpring(0));
      return;
    }
    hop.value = 0; squash.value = 0;
    tilt.value = withSpring(state === "thinking" ? 5 : 0);
    if (state === "talking") {
      wave.value = withRepeat(withSequence(withTiming(1, { duration: 320, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 320, easing: Easing.inOut(Easing.quad) })), -1, false);
    } else {
      cancelAnimation(wave);
      wave.value = withSpring(0.15);
    }
  }, [hop, reduceMotion, squash, state, tilt, wave]);

  const bob = useDerivedValue(() => Math.sin(clock.value * Math.PI * 2 + Math.PI / 3) * 4.5);
  const breath = useDerivedValue(() => Math.sin(clock.value * Math.PI * 2 + Math.PI / 3 - Math.PI / 2) * 0.02);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value - hop.value * 30 },
      { rotate: `${tilt.value}deg` },
      { scaleY: 1 + breath.value - squash.value * 0.22 + hop.value * 0.1 },
      { scaleX: 1 - breath.value + squash.value * 0.2 - hop.value * 0.07 },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => ({ opacity: 0.2 - hop.value * 0.12, transform: [{ scaleX: 1 - hop.value * 0.32 + squash.value * 0.12 }] }));
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const pupilStyle = useAnimatedStyle(() => ({ transform: [{ translateX: state === "scanning" ? 3 : state === "thinking" ? 2.5 : 0 }, { translateY: state === "thinking" ? -2 : 0.5 }] }));
  // Positive degrees swing this arm away from the body: it hangs on the
  // helper's left, so a negative angle would fold it across the chest.
  const armStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(wave.value, [0, 1], [18, 62])}deg` }] }));
  const smileStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: isCelebration(state) ? 1.25 : 1 }, { scaleY: isCelebration(state) ? 1.5 : 1 }] }));

  return <View style={styles.slot}>
    <Animated.View style={[styles.shadow, shadowStyle]} />
    <Sparkles active={isCelebration(state) && !reduceMotion} />
    <Animated.View style={[styles.bodyAnchor, bodyStyle]}>
      <View style={[styles.body, styles.bodyMint]}>
        <View style={[styles.antenna, { backgroundColor: MINT_DARK }]} />
        <View style={[styles.antennaTip, { backgroundColor: MINT_LIGHT }]} />
        <View style={[styles.belly, { backgroundColor: MINT_LIGHT }]} />
        <View style={styles.face}>
          <Animated.View style={[styles.eye, eyeStyle]}><Animated.View style={[styles.pupil, pupilStyle]}><View style={styles.glint} /></Animated.View></Animated.View>
          <Animated.View style={[styles.eye, eyeStyle]}><Animated.View style={[styles.pupil, pupilStyle]}><View style={styles.glint} /></Animated.View></Animated.View>
        </View>
        {/* A smile is the bottom half of a ring: a bordered box, over-rounded
            and clipped, curves where a rectangle cannot. */}
        <View style={[styles.blush, styles.blushLeft, { backgroundColor: MINT_DARK }]} />
        <View style={[styles.blush, styles.blushRight, { backgroundColor: MINT_DARK }]} />
        <Animated.View style={[styles.smile, smileStyle]} />
      </View>
      <Animated.View style={[styles.arm, styles.armLeft, { backgroundColor: MINT_DARK }, armStyle]}>
        <View style={[styles.hand, { backgroundColor: MINT_LIGHT }]} />
      </Animated.View>
    </Animated.View>
  </View>;
}

/* ------------------------------------------------------------------ *
 * The coupon between them — the thing being looked at.
 * ------------------------------------------------------------------ */

function CouponProp({ state, reduceMotion }: { state: CharacterState; reduceMotion: boolean }) {
  const float = useClock(!reduceMotion, 3000);
  const scan = useSharedValue(0);
  const pop = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) { scan.value = 0; pop.value = isCelebration(state) ? 1 : 0; return; }
    if (state === "scanning") {
      scan.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, false);
    } else {
      cancelAnimation(scan);
      scan.value = 0;
    }
    pop.value = isCelebration(state)
      ? withSequence(withDelay(180, withSpring(1.12, { damping: 7 })), withSpring(1, { damping: 12 }))
      : withSpring(0.98, { damping: 14 });
  }, [pop, reduceMotion, scan, state]);

  const drift = useDerivedValue(() => Math.sin(float.value * Math.PI * 2) * 3.5);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: drift.value },
      { rotate: `${Math.sin(float.value * Math.PI * 2 + 1) * 2.2}deg` },
      { scale: pop.value === 0 ? 1 : pop.value },
    ],
  }));
  const scanStyle = useAnimatedStyle(() => ({
    opacity: state === "scanning" ? interpolate(scan.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0]) : 0,
    transform: [{ translateY: interpolate(scan.value, [0, 1], [4, 52]) }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: isCelebration(state) ? 1 : 0,
    transform: [{ scale: isCelebration(state) ? pop.value : 0 }],
  }));

  return <Animated.View style={[styles.card, cardStyle]}>
    <View style={[styles.cardLine, { width: 40 }]} />
    <View style={[styles.cardLine, { width: 26 }]} />
    <View style={[styles.cardChip]} />
    <Animated.View style={[styles.scanBar, scanStyle]} />
    <Animated.View style={[styles.cardCheck, checkStyle]}>
      <View style={styles.checkShort} />
      <View style={styles.checkLong} />
    </Animated.View>
  </Animated.View>;
}

/** Four sparks thrown off a celebration, on their own short arcs. */
function Sparkles({ active }: { active: boolean }) {
  return <View style={styles.sparkLayer}>
    {[0, 1, 2, 3].map((index) => <Spark key={index} index={index} active={active} />)}
  </View>;
}

function Spark({ index, active }: { index: number; active: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!active) { progress.value = 0; return; }
    progress.value = 0;
    progress.value = withDelay(140 + index * 90, withTiming(1, { duration: 780, easing: Easing.out(Easing.quad) }));
  }, [active, index, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2, 1], [0, 1, 0]),
    transform: [
      { translateX: (index % 2 === 0 ? -1 : 1) * (14 + index * 7) * progress.value },
      { translateY: -progress.value * (34 + index * 9) },
      { rotate: `${progress.value * 200}deg` },
      { scale: interpolate(progress.value, [0, 0.3, 1], [0.3, 1, 0.4]) },
    ],
  }));
  return <Animated.View style={[styles.spark, { backgroundColor: index % 2 === 0 ? "#FFC53D" : MINT }, style]} />;
}

const BODY = 76;
const SLOT_H = 132;
/**
 * iOS reserves roughly the first 20pt of the screen edge for the interactive
 * back gesture, and that gesture is handled below React Native — a
 * PanResponder cannot outvote it. So the mascot simply never rests or lands
 * inside that strip: a touch on it is then always a touch on the mascot.
 */
const EDGE_GUARD = 28;

const styles = StyleSheet.create({
  scene: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  cast: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 2 },
  spotlight: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "rgba(88, 223, 198, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
    overflow: "hidden",
  },
  // A soft top-light on the disc, so the bubble reads as a bead of glass
  // rather than a flat swatch behind the mascot.
  spotlightGloss: { position: "absolute", top: 0, left: 0, right: 0, bottom: "45%", backgroundColor: "rgba(255,255,255,0.35)" },
  spotlightBody: { alignItems: "center", justifyContent: "flex-end" },
  floating: { position: "absolute", alignItems: "center", justifyContent: "center", zIndex: 20 },
  floatingBody: { alignItems: "center", justifyContent: "center" },
  slot: { width: 92, height: SLOT_H, alignItems: "center", justifyContent: "flex-end" },
  // The investigator reaches across the card, so it has to draw over it.
  slotFront: { zIndex: 3 },

  shadow: { position: "absolute", bottom: 2, width: 60, height: 11, borderRadius: 6, backgroundColor: INK, opacity: 0.2 },
  bodyAnchor: { alignItems: "center", justifyContent: "flex-end", marginBottom: 8 },
  body: { width: BODY, height: BODY + 8, borderRadius: 34, alignItems: "center", overflow: "visible" },
  bodyBlue: { backgroundColor: BLUE },
  bodyMint: { backgroundColor: MINT },
  belly: { position: "absolute", bottom: 8, width: BODY - 26, height: 30, borderRadius: 16, opacity: 0.55 },
  cap: { position: "absolute", top: -14, width: BODY - 18, height: 17, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  capBrim: { position: "absolute", top: 1, width: BODY + 12, height: 7, borderRadius: 4 },
  antenna: { position: "absolute", top: -13, width: 4, height: 15, borderRadius: 2 },
  antennaTip: { position: "absolute", top: -20, width: 11, height: 11, borderRadius: 6 },

  face: { flexDirection: "row", gap: 9, marginTop: 16 },
  eye: { width: 23, height: 25, borderRadius: 11, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  pupil: { width: 13, height: 13, borderRadius: 7, backgroundColor: INK, alignItems: "center", justifyContent: "center" },
  glint: { position: "absolute", top: 1.5, right: 1.5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#FFFFFF" },
  glintSmall: { position: "absolute", bottom: 2, left: 2, width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#FFFFFF", opacity: 0.8 },
  blush: { position: "absolute", top: 48, width: 15, height: 9, borderRadius: 5, opacity: 0.55 },
  blushLeft: { left: 7 },
  blushRight: { right: 7 },
  mouth: { marginTop: 7, width: 16, height: 6, borderRadius: 4, backgroundColor: INK, opacity: 0.85 },
  // Over-rounded and clipped: only the lower arc of the border shows.
  smile: { position: "absolute", top: 52, width: 24, height: 15, borderRadius: 11, borderWidth: 3, borderColor: INK, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", opacity: 0.85 },

  arm: { position: "absolute", top: 38, width: 10, height: 34, borderRadius: 5, transformOrigin: "top center", alignItems: "center" },
  armRight: { right: -11 },
  armLeft: { left: -11 },
  hand: { position: "absolute", bottom: -7, width: 16, height: 16, borderRadius: 8 },

  magnifier: { position: "absolute", bottom: -21, alignItems: "center", justifyContent: "center" },
  magnifierLens: { width: 26, height: 26, borderRadius: 13, borderWidth: 3.5, borderColor: BLUE_DARK, backgroundColor: "rgba(255,255,255,0.55)" },
  magnifierGlint: { position: "absolute", top: 5, left: 6, width: 7, height: 4, borderRadius: 3, backgroundColor: "#FFFFFF", opacity: 0.9, transform: [{ rotate: "-35deg" }] },

  card: { width: 58, height: 74, marginBottom: 38, borderRadius: 9, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#D6E1F5", paddingTop: 12, paddingHorizontal: 9, gap: 6, overflow: "hidden", boxShadow: "0px 3px 8px rgba(22, 35, 58, 0.12)", elevation: 3 },
  cardLine: { height: 5, borderRadius: 3, backgroundColor: "#DCE5F6" },
  cardChip: { position: "absolute", bottom: 9, left: 9, width: 20, height: 14, borderRadius: 4, backgroundColor: "#FFD98A" },
  scanBar: { position: "absolute", left: 0, right: 0, height: 3, backgroundColor: BLUE, opacity: 0.75, boxShadow: "0px 0px 6px rgba(40, 100, 240, 0.9)" },
  cardCheck: { position: "absolute", left: 7, top: 7, width: 22, height: 22, borderRadius: 11, backgroundColor: "#16A34A", alignItems: "center", justifyContent: "center" },
  checkShort: { position: "absolute", width: 3, height: 7, borderRadius: 2, backgroundColor: "#FFFFFF", transform: [{ rotate: "-45deg" }, { translateX: -4 }, { translateY: 2 }] },
  checkLong: { position: "absolute", width: 3, height: 12, borderRadius: 2, backgroundColor: "#FFFFFF", transform: [{ rotate: "35deg" }, { translateX: 2 }, { translateY: -1 }] },

  sparkLayer: { position: "absolute", top: 40, alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  spark: { position: "absolute", width: 8, height: 8, borderRadius: 2 },
});
