import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Platform, StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import * as SplashScreen from "expo-splash-screen";

type Props = { appReady: boolean; canReveal: boolean; onFinish: () => void };

/** `app.json` -> expo-splash-screen -> imageWidth: the poster sits exactly where the native splash drew it. */
const LOGO_SIZE = 240;
/** Built by `scripts/build-launch-video.py`; the poster is the video's first frame. */
const POSTER = require("../../../assets/branding/launch/launch-poster.png");
const VIDEO = require("../../../assets/branding/launch/launch-video.mp4");
// Android 12+ masks the splash icon to a circle, so its native splash is the
// tint alone and the logo fades in here instead of appearing already drawn.
const POSTER_FADES_IN = Platform.OS === "android";

/** One reveal per cold launch; navigation stays covered until auth is settled. */
export function BrandLaunchAnimation({ appReady, canReveal, onFinish }: Props) {
  const [posterReady, setPosterReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [started, setStarted] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(POSTER_FADES_IN ? 0 : 1)).current;
  const scale = useRef(new Animated.Value(1)).current;
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
    const timeout = setTimeout(() => setPosterReady(true), 1500);
    return () => clearTimeout(timeout);
  }, [canReveal]);

  // The poster is the native splash redrawn, so hiding the splash changes
  // nothing on screen; the video then starts from that same frame.
  useEffect(() => {
    if (!canReveal || !posterReady || reduceMotion === null) return;
    let active = true;
    void SplashScreen.hideAsync().catch((error) => console.warn("Launch splash hide failed", error));
    if (POSTER_FADES_IN) {
      Animated.timing(logoOpacity, { toValue: 1, duration: reduceMotion ? 0 : 180, useNativeDriver: true }).start();
    }
    if (reduceMotion) setIntroDone(true);
    else setStarted(true);
    // A failed load or blocked autoplay must never trap users on the launch screen.
    const timeout = setTimeout(() => { if (active) setIntroDone(true); }, 8000);
    return () => { active = false; clearTimeout(timeout); };
  }, [canReveal, posterReady, reduceMotion, logoOpacity]);

  useEffect(() => {
    if (!appReady || !introDone) return;
    // The logo eases forward as the screen fades, the way the app opens out of it.
    const exit = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : 220, useNativeDriver: true }),
      Animated.timing(scale, {
        toValue: reduceMotion ? 1 : 1.08, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]);
    exit.start(({ finished }) => { if (finished) finishRef.current(); });
    return () => exit.stop();
  }, [appReady, introDone, reduceMotion, opacity, scale]);

  return (
    <Animated.View style={[styles.overlay, { opacity }]} accessibilityViewIsModal>
      <Animated.View style={[styles.logo, { opacity: logoOpacity, transform: [{ scale }] }]}>
        <Animated.Image
          source={POSTER}
          accessibilityLabel="קופון מאסטר"
          resizeMode="contain"
          onLoad={() => setPosterReady(true)}
          onError={() => setPosterReady(true)}
          style={styles.logoMedia}
        />
        {reduceMotion === false ? <SilentLaunchVideo play={started} onDone={() => setIntroDone(true)} /> : null}
      </Animated.View>
      {introDone && !appReady ? <ActivityIndicator accessibilityLabel="טוען את האפליקציה" style={styles.loader} color="#1f6fd1" /> : null}
    </Animated.View>
  );
}

/** Loads paused over the poster. Keep the native video surface visible so its frames can render. */
function SilentLaunchVideo({ play, onDone }: { play: boolean; onDone: () => void }) {
  const player = useVideoPlayer(VIDEO, (instance) => {
    instance.muted = true;
    instance.volume = 0;
    instance.audioMixingMode = "mixWithOthers";
    instance.showNowPlayingNotification = false;
  });
  useEffect(() => {
    if (play) player.play();
  }, [player, play]);
  useEffect(() => {
    const ended = player.addListener("playToEnd", onDone);
    const status = player.addListener("statusChange", ({ status, error }) => {
      if (status === "error") {
        console.warn("Launch video failed", error);
        onDone();
      }
    });
    return () => { ended.remove(); status.remove(); };
  }, [player, onDone]);
  return <VideoView player={player} style={styles.logoMedia} contentFit="contain"
    nativeControls={false} playsInline allowsPictureInPicture={false}
    fullscreenOptions={{ enable: false }}
    accessible={false} />;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1000, elevation: 1000,
    alignItems: "center", justifyContent: "center", backgroundColor: "#e8f2fd" },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  // Image assets have intrinsic dimensions; offsets alone do not constrain them.
  logoMedia: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  loader: { position: "absolute", bottom: 96, alignSelf: "center" },
});
