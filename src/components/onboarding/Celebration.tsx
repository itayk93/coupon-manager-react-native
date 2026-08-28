import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { palette } from "@/lib/theme";

const COLORS = [palette.primary, palette.primaryLight, palette.success, palette.warning, palette.accent];
const PIECES = 22;

type Piece = { left: number; delay: number; drift: number; spin: number; color: string; size: number };

function buildPieces(width: number): Piece[] {
  return Array.from({ length: PIECES }, (_, index) => ({
    left: (index / PIECES) * width + (Math.random() * width) / PIECES,
    delay: Math.round(Math.random() * 260),
    drift: (Math.random() - 0.5) * 90,
    spin: 220 + Math.random() * 460,
    color: COLORS[index % COLORS.length],
    size: 6 + Math.random() * 6,
  }));
}

/**
 * A one-shot confetti burst for the moment the first coupon is recognised.
 *
 * Deliberately dependency-free: the app already ships Reanimated, and a
 * particle library would be a lot of bundle for two seconds of paper.
 * Renders nothing at all when the user asked for reduced motion.
 */
export function Confetti({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const { width } = useWindowDimensions();
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (active && !reduceMotion) setPieces(buildPieces(width));
    else setPieces([]);
  }, [active, reduceMotion, width]);

  if (!pieces.length) return null;

  return <View style={styles.confettiLayer}>
    {pieces.map((piece, index) => <ConfettiPiece key={index} piece={piece} />)}
  </View>;
}

function ConfettiPiece({ piece }: { piece: Piece }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(piece.delay, withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }));
  }, [piece.delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * progress.value,
    transform: [
      { translateY: progress.value * 260 },
      { translateX: progress.value * piece.drift },
      { rotate: `${progress.value * piece.spin}deg` },
    ],
  }));

  return <Animated.View style={[styles.piece, { left: piece.left, width: piece.size, height: piece.size * 1.7, backgroundColor: piece.color }, style]} />;
}

/**
 * A number that rolls up to its target instead of appearing.
 *
 * The value is animated on the JS side rather than through an animated style:
 * the digits themselves have to change, and Reanimated cannot interpolate the
 * text content of a Text node.
 */
export function CountUp({ value, prefix = "", suffix = "", reduceMotion, style }: { value: number; prefix?: string; suffix?: string; reduceMotion: boolean; style?: any }) {
  const [shown, setShown] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) { setShown(value); return; }
    const duration = 900;
    const start = Date.now();
    setShown(0);
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out so the last digits settle rather than slam into place.
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress >= 1) clearInterval(timer);
    }, 32);
    return () => clearInterval(timer);
  }, [reduceMotion, value]);

  // The currency mark is written into the string on the side it belongs on,
  // rather than left to the paragraph direction: this number is centred with
  // no writing direction of its own, and a bare suffix flipped sides between
  // the app and the browser.
  return <Text style={style}>{prefix}{shown.toLocaleString("he-IL")}{suffix}</Text>;
}

const styles = StyleSheet.create({
  confettiLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden", pointerEvents: "none" },
  piece: { position: "absolute", top: -20, borderRadius: 2 },
});
