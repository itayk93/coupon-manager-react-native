import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, Platform, StyleSheet } from "react-native";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useNativeDriver } from "@/lib/animation";

/**
 * The wait between one screen and the next, in the app's own clothes.
 *
 * What this replaces was an activity indicator alone on a flat background —
 * the app looking like it had lost its place. This is the launch screen coming
 * back instead: the same wordmark on the same tint at the same 240pt the iOS
 * launch image, the native splash and the document's own launch screen all
 * draw, so signing in reads as the app opening rather than stalling.
 *
 * It waits `PATIENCE` before covering anything, because a transition that
 * resolves in a third of a second is not a wait, and flashing a full-screen
 * logo across it would be worse than the pause it was meant to explain. The
 * spinner comes later still, once the wait is long enough to be worth
 * admitting to, which is what the launch animation does.
 *
 * Not on the way in, though. This is also the curtain that keeps the wrong
 * side of the auth guard off the screen — a protected route opened without a
 * session renders for the moment before the redirect lands — so until the app
 * has been ready once, it covers immediately and patience starts after.
 */

// On web this is the file the launch screen already painted, so it is in the
// browser's cache and costs nothing; the master it is drawn from is 685KB, and
// no web page should pay that to say "one moment".
const WORDMARK =
  Platform.OS === "web"
    ? { uri: "/splash/wordmark.png" }
    : require("../../../assets/branding/kuponi-wordmark/color-stacked.png");

const TINT = "#e8f2fd";
const LOGO = 240; // Points. `app.json` -> expo-splash-screen -> imageWidth.
const FADE = 200;
const PATIENCE = 400;
const SPINNER_AFTER = 1400;

export function BrandWaitOverlay({ visible }: { visible: boolean }) {
  const [shown, setShown] = useState(false);
  const [slow, setSlow] = useState(false);
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const readyOnce = useRef(false);

  useEffect(() => {
    if (!visible) {
      readyOnce.current = true;
      return;
    }
    const patience = setTimeout(() => setShown(true), readyOnce.current ? PATIENCE : 0);
    const spinner = setTimeout(() => setSlow(true), SPINNER_AFTER);
    return () => {
      clearTimeout(patience);
      clearTimeout(spinner);
    };
  }, [visible]);

  useEffect(() => {
    if (!shown) return;
    const fade = Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : FADE,
      easing: Easing.out(Easing.quad),
      useNativeDriver,
    });
    // Unmounting only on the way out keeps the fade from being cut off, and
    // keeps a wait that returns from starting over at zero.
    fade.start(({ finished }) => {
      if (!finished || visible) return;
      setShown(false);
      setSlow(false);
    });
    return () => fade.stop();
  }, [visible, shown, reduceMotion, opacity]);

  if (!shown) return null;
  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="auto" accessibilityViewIsModal>
      <Image
        source={WORDMARK}
        accessibilityLabel="קופון מאסטר"
        resizeMode="contain"
        style={styles.wordmark}
      />
      {slow ? (
        <ActivityIndicator accessibilityLabel="טוען את האפליקציה" style={styles.loader} color="#1f6fd1" />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 900,
    elevation: 900,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TINT,
  },
  wordmark: { width: LOGO, height: LOGO },
  loader: { position: "absolute", bottom: 96, alignSelf: "center" },
});
