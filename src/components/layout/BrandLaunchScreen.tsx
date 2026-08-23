import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
} from "react-native";

const logo = require("../../../assets/brand-logo-stacked.png");

const LOGO_WIDTH = 300;
const LOGO_HEIGHT = (LOGO_WIDTH * 540) / 744;
const TOP_HEIGHT = (210 / 540) * LOGO_HEIGHT;
const TICKET_TOP = (188 / 540) * LOGO_HEIGHT;
const TICKET_HEIGHT = (148 / 540) * LOGO_HEIGHT;
const BOTTOM_TOP = (326 / 540) * LOGO_HEIGHT;

type BrandLaunchScreenProps = {
  appReady: boolean;
  onFinish: () => void;
};

/**
 * Branded handoff after the native splash. The reveal runs while auth and
 * navigation settle, then exits as soon as both the app and motion are ready.
 */
export function BrandLaunchScreen({
  appReady,
  onFinish,
}: BrandLaunchScreenProps) {
  const topProgress = useRef(new Animated.Value(0)).current;
  const bottomProgress = useRef(new Animated.Value(0)).current;
  const ticketProgress = useRef(new Animated.Value(0)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;
  const motionFinished = useRef(false);
  const appReadyRef = useRef(appReady);
  const finishStarted = useRef(false);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    appReadyRef.current = appReady;
    onFinishRef.current = onFinish;
  }, [appReady, onFinish]);

  const finishIfReady = () => {
    if (!motionFinished.current || !appReadyRef.current || finishStarted.current) {
      return;
    }

    finishStarted.current = true;
    Animated.timing(exitProgress, {
      toValue: 1,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinishRef.current();
    });
  };

  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | undefined;

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (!mounted) return;

        if (reduceMotion) {
          topProgress.setValue(1);
          bottomProgress.setValue(1);
          ticketProgress.setValue(1);
          motionFinished.current = true;
          finishIfReady();
          return;
        }

        animation = Animated.parallel([
          Animated.timing(topProgress, {
            toValue: 1,
            duration: 620,
            easing: Easing.out(Easing.back(1.25)),
            useNativeDriver: true,
          }),
          Animated.timing(bottomProgress, {
            toValue: 1,
            duration: 680,
            delay: 60,
            easing: Easing.out(Easing.back(1.2)),
            useNativeDriver: true,
          }),
          Animated.timing(ticketProgress, {
            toValue: 1,
            duration: 520,
            delay: 310,
            easing: Easing.out(Easing.back(1.8)),
            useNativeDriver: true,
          }),
        ]);

        animation.start(({ finished }) => {
          if (!mounted || !finished) return;
          motionFinished.current = true;
          finishIfReady();
        });
      });

    return () => {
      mounted = false;
      animation?.stop();
    };
  }, [bottomProgress, ticketProgress, topProgress]);

  useEffect(() => {
    finishIfReady();
  }, [appReady]);

  const topTranslateY = topProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [34, 0],
  });
  const bottomTranslateY = bottomProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-34, 0],
  });
  const ticketScale = ticketProgress.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: [0.35, 1.14, 1],
  });
  const ticketRotate = ticketProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["-28deg", "0deg"],
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="auto"
      style={[
        styles.overlay,
        {
          opacity: exitProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          }),
          transform: [
            {
              scale: exitProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.035],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.logoCanvas}>
        <Animated.View
          style={[
            styles.topClip,
            {
              opacity: topProgress,
              transform: [{ translateY: topTranslateY }],
            },
          ]}
        >
          <Image source={logo} resizeMode="contain" style={styles.logoImage} />
        </Animated.View>

        <Animated.View
          style={[
            styles.ticketClip,
            {
              opacity: ticketProgress,
              transform: [{ scale: ticketScale }, { rotate: ticketRotate }],
            },
          ]}
        >
          <Image source={logo} resizeMode="contain" style={styles.ticketImage} />
        </Animated.View>

        <Animated.View
          style={[
            styles.bottomClip,
            {
              opacity: bottomProgress,
              transform: [{ translateY: bottomTranslateY }],
            },
          ]}
        >
          <Image source={logo} resizeMode="contain" style={styles.bottomImage} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf9f6",
  },
  logoCanvas: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  logoImage: {
    position: "absolute",
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  topClip: {
    position: "absolute",
    top: 0,
    width: LOGO_WIDTH,
    height: TOP_HEIGHT,
    overflow: "hidden",
  },
  ticketClip: {
    position: "absolute",
    top: TICKET_TOP,
    width: LOGO_WIDTH,
    height: TICKET_HEIGHT,
    overflow: "hidden",
  },
  ticketImage: {
    position: "absolute",
    top: -TICKET_TOP,
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  bottomClip: {
    position: "absolute",
    top: BOTTOM_TOP,
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT - BOTTOM_TOP,
    overflow: "hidden",
  },
  bottomImage: {
    position: "absolute",
    top: -BOTTOM_TOP,
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
