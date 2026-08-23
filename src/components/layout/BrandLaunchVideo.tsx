import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useEventListener } from "expo";
import * as SplashScreen from "expo-splash-screen";
import { useVideoPlayer, VideoView } from "expo-video";

const launchVideo = require("../../../assets/brand-logo-reveal.mp4");

type BrandLaunchVideoProps = {
  appReady: boolean;
  canReveal: boolean;
  onFinish: () => void;
};

/** Plays the approved brand reveal once, without exposing player controls. */
export function BrandLaunchVideo({
  appReady,
  canReveal,
  onFinish,
}: BrandLaunchVideoProps) {
  const [videoEnded, setVideoEnded] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const revealStarted = useRef(false);
  const player = useVideoPlayer(launchVideo, (instance) => {
    instance.loop = false;
    instance.muted = true;
  });

  useEventListener(player, "playToEnd", () => setVideoEnded(true));
  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") {
      SplashScreen.hideAsync().catch(() => {});
      setVideoEnded(true);
    }
  });

  // Keep the native splash above the prepared video. Start from frame zero only
  // after the native layer has actually disappeared.
  useEffect(() => {
    if (!canReveal || !firstFrameReady || revealStarted.current) return;

    let mounted = true;
    revealStarted.current = true;

    SplashScreen.hideAsync()
      .catch(() => {})
      .then(() => {
        if (!mounted) return;
        player.currentTime = 0;
        player.play();
      });

    return () => {
      mounted = false;
    };
  }, [canReveal, firstFrameReady, player]);

  // Never trap the user behind the native splash if video preparation fails.
  useEffect(() => {
    if (!canReveal || videoEnded) return;

    const fallback = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setVideoEnded(true);
    }, 5000);
    return () => clearTimeout(fallback);
  }, [canReveal, videoEnded]);

  useEffect(() => {
    if (appReady && videoEnded) onFinish();
  }, [appReady, onFinish, videoEnded]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="auto"
      style={styles.overlay}
    >
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        onFirstFrameRender={() => setFirstFrameReady(true)}
      />
      {videoEnded && !appReady ? (
        <ActivityIndicator style={styles.loader} color="#1f6fd1" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: "#faf9f6",
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
  loader: {
    position: "absolute",
    bottom: 96,
    alignSelf: "center",
  },
});
