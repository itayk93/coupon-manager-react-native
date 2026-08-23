import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";

const launchVideo = require("../../../assets/brand-logo-reveal.mp4");

type BrandLaunchVideoProps = {
  appReady: boolean;
  onFinish: () => void;
};

/** Plays the approved brand reveal once, without exposing player controls. */
export function BrandLaunchVideo({ appReady, onFinish }: BrandLaunchVideoProps) {
  const [videoEnded, setVideoEnded] = useState(false);
  const player = useVideoPlayer(launchVideo, (instance) => {
    instance.loop = false;
    instance.muted = true;
    instance.play();
  });

  useEventListener(player, "playToEnd", () => setVideoEnded(true));
  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") setVideoEnded(true);
  });

  // Never trap the user behind the launch layer if a device fails to decode it.
  useEffect(() => {
    const fallback = setTimeout(() => setVideoEnded(true), 3500);
    return () => clearTimeout(fallback);
  }, []);

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
