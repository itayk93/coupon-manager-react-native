import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";
import * as SplashScreen from "expo-splash-screen";

type Props = { appReady: boolean; canReveal: boolean; onFinish: () => void };

/** One reveal per cold launch; navigation stays covered until auth is settled. */
export function BrandLaunchAnimation({ appReady, canReveal, onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const [imageReady, setImageReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const finishRef = useRef(onFinish);
  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  useEffect(() => {
    let active = true;
    const update = (value: boolean) => { if (active) setReduceMotion(value); };
    // Default to no motion if the accessibility service cannot answer.
    const timeout = setTimeout(() => update(true), 500);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", update);
    AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => update(true)).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!canReveal) return;
    // Asset decode failures must not hold the native splash indefinitely.
    const timeout = setTimeout(() => setImageReady(true), 1500);
    return () => clearTimeout(timeout);
  }, [canReveal]);

  useEffect(() => {
    if (!canReveal || !imageReady || reduceMotion === null) return;
    let active = true;
    const intro = Animated.timing(progress, {
      toValue: 1, duration: reduceMotion ? 0 : 720,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    void SplashScreen.hideAsync().catch(() => {}).then(() => {
      if (active) intro.start(({ finished }) => { if (finished && active) setIntroDone(true); });
    });
    return () => { active = false; intro.stop(); };
  }, [canReveal, imageReady, reduceMotion, progress]);

  useEffect(() => {
    if (!appReady || !introDone) return;
    const exit = Animated.timing(opacity, {
      toValue: 0, duration: reduceMotion ? 0 : 220, useNativeDriver: true,
    });
    exit.start(({ finished }) => { if (finished) finishRef.current(); });
    return () => exit.stop();
  }, [appReady, introDone, reduceMotion, opacity]);

  const size = Math.min(width * 0.72, height * 0.48, 340);
  return (
    <Animated.View style={[styles.overlay, { opacity }]} accessibilityViewIsModal>
      <Animated.Image
        source={require("../../../assets/brand-logo-premium.png")}
        accessibilityLabel="Coupon Master"
        resizeMode="contain"
        onLoad={() => setImageReady(true)}
        onError={() => setImageReady(true)}
        style={{ width: size, height: size, opacity: progress, transform: [
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
        ] }}
      />
      {introDone && !appReady ? <ActivityIndicator accessibilityLabel="טוען את האפליקציה" style={styles.loader} color="#1f6fd1" /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1000, elevation: 1000,
    alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f6" },
  loader: { position: "absolute", bottom: 96, alignSelf: "center" },
});
