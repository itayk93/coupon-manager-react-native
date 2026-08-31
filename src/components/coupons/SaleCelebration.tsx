import React from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, useReducedMotion, ZoomIn } from "react-native-reanimated";
import { Confetti } from "@/components/onboarding/Celebration";
import { CharacterSpotlight } from "@/components/onboarding/CharacterRig";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";

/**
 * The "you sold a coupon" moment. A one-shot brand-coloured confetti burst over
 * a cheering mascot, then it calls `onDone` so the caller can move on.
 *
 * Dependency-free on purpose: reuses the Reanimated confetti the app already
 * ships for onboarding. Honours Reduce Motion — no burst, just a short beat.
 */
export function SaleCelebration({ title = "מכרת קופון!", subtitle = "נרשם אצלך בקופונים שמכרתי", onDone }: {
  title?: string;
  subtitle?: string;
  onDone: () => void;
}) {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const timer = setTimeout(onDone, reduceMotion ? 650 : 2100);
    return () => clearTimeout(timer);
  }, [onDone, reduceMotion]);

  return (
    <Animated.View
      style={styles.overlay}
      pointerEvents="none"
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(200)}
    >
      <Confetti active reduceMotion={reduceMotion} />
      <Animated.View
        entering={reduceMotion ? FadeIn : ZoomIn.springify().damping(14)}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      >
        <CharacterSpotlight character="helper" state="cheering" size="large" tone="success" />
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", zIndex: 50, backgroundColor: "rgba(16,24,40,0.38)" },
  card: { alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 24, borderRadius: radii.xl, borderWidth: 1, maxWidth: 320 },
  title: { fontFamily: fonts.display, fontSize: 22, fontWeight: "800", textAlign: "center" },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
