import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, StyleSheet, useWindowDimensions } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import * as SplashScreen from "expo-splash-screen";

type Props = { appReady: boolean; canReveal: boolean; onFinish: () => void };

/** One reveal per cold launch; navigation stays covered until auth is settled. */
export function BrandLaunchAnimation({ appReady, canReveal, onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const [imageReady, setImageReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [introDone, setIntroDone] = useState(false);
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
    void SplashScreen.hideAsync().catch((error) => console.warn("Launch splash hide failed", error));
    if (reduceMotion) setIntroDone(true);
    // A failed load or blocked autoplay must never trap users on the launch screen.
    const timeout = setTimeout(() => { if (active) setIntroDone(true); }, 6500);
    return () => { active = false; clearTimeout(timeout); };
  }, [canReveal, imageReady, reduceMotion]);

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
      {reduceMotion === false && canReveal ? (
        <SilentLaunchVideo onReady={() => setImageReady(true)} onDone={() => setIntroDone(true)} />
      ) : (
        <Animated.Image
          source={require("../../../assets/branding/kuponi-wordmark/color-stacked.png")}
          accessibilityLabel="קופון מאסטר"
          resizeMode="contain"
          onLoad={() => setImageReady(true)}
          onError={() => setImageReady(true)}
          style={{ width: size, height: size }}
        />
      )}
      {introDone && !appReady ? <ActivityIndicator accessibilityLabel="טוען את האפליקציה" style={styles.loader} color="#1f6fd1" /> : null}
    </Animated.View>
  );
}

function SilentLaunchVideo({ onReady, onDone }: { onReady: () => void; onDone: () => void }) {
  const player = useVideoPlayer(require("../../../assets/branding/opening-screen-silent.mp4"), (instance) => {
    instance.muted = true;
    instance.volume = 0;
    instance.audioMixingMode = "mixWithOthers";
    instance.showNowPlayingNotification = false;
  });
  useEffect(() => {
    player.play();
  }, [player]);
  useEffect(() => {
    const ended = player.addListener("playToEnd", onDone);
    const status = player.addListener("statusChange", ({ status, error }) => {
      if (status === "error") {
        console.warn("Launch video failed", error);
        onReady();
        onDone();
      }
    });
    return () => { ended.remove(); status.remove(); };
  }, [player, onReady, onDone]);
  return <VideoView player={player} style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]} contentFit="contain"
    nativeControls={false} playsInline allowsPictureInPicture={false}
    fullscreenOptions={{ enable: false }} onFirstFrameRender={onReady}
    accessibilityLabel="קופון מאסטר" />;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1000, elevation: 1000,
    alignItems: "center", justifyContent: "center", backgroundColor: "#e8f2fd" },
  loader: { position: "absolute", bottom: 96, alignSelf: "center" },
});
