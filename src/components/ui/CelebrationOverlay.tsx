import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, useReducedMotion, ZoomIn } from "react-native-reanimated";
import { Confetti } from "@/components/onboarding/Celebration";
import { IlsAmount } from "@/components/ui/IlsAmount";
import { Kuponi, type KuponiState } from "@/components/ui/Kuponi";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";

/**
 * The shape every "you just did something with money" moment takes: a scrim, a
 * confetti burst, Kuponi cheering, and a line. It calls `onDone` so the caller
 * can move on.
 *
 * One component rather than one per event, because a user who sells a coupon
 * and a user who finishes one should recognise the same moment. `amount` is
 * the only variation: when the event has a figure the app knows, the figure is
 * the headline and counts up, because that is the part worth looking at.
 *
 * Dependency-free: reuses the Reanimated confetti shipped for onboarding.
 * Honours Reduce Motion — no burst, no count, just a short beat.
 */
export function CelebrationOverlay({
  title,
  subtitle,
  amount = 0,
  amountCaption,
  intro,
  onDone,
}: {
  title: string;
  subtitle?: string;
  /** Shekels this moment is about. 0 hides the figure entirely. */
  amount?: number;
  /** The short line under the figure, e.g. "חסכת". */
  amountCaption?: string;
  /** A one-shot Kuponi plays before he settles into cheering. `relieved` on a
   *  rescue: he was worried about this coupon, and now he is not. */
  intro?: KuponiState;
  onDone: () => void;
}) {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [introDone, setIntroDone] = useState(false);
  const playing: KuponiState = intro && !introDone ? intro : "cheering";

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Long enough to read the figure, short enough not to be in the way. An
    // intro is a 1.5s sequence of its own and needs room before the beat.
    const base = amount > 0 ? 2600 : 2100;
    const timer = setTimeout(onDone, reduceMotion ? 650 : intro ? base + 1200 : base);
    return () => clearTimeout(timer);
  }, [onDone, reduceMotion, amount, intro]);

  return (
    <Animated.View
      style={styles.overlay}
      pointerEvents="none"
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(200)}
    >
      <Confetti active reduceMotion={reduceMotion} />
      <Animated.View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={[title, amountCaption, amount > 0 ? `${amount} שקלים` : null, subtitle]
          .filter(Boolean)
          .join(". ")}
        entering={reduceMotion ? FadeIn : ZoomIn.springify().damping(14)}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      >
        <Kuponi
          state={playing}
          size="large"
          loop={playing !== intro}
          onFinish={() => setIntroDone(true)}
        />
        {amount > 0 ? (
          <View style={styles.figure} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {amountCaption ? (
              <Text style={[styles.caption, { color: theme.successText }]}>{amountCaption}</Text>
            ) : null}
            {/* Mounts at the final value under Reduce Motion; `animate` starts
                it at zero so the figure arrives rather than appears. */}
            <IlsAmount
              value={amount}
              animate={!reduceMotion}
              countFromZero
              style={[styles.amount, { color: theme.successText }]}
              currencyStyle={styles.amountCurrency}
            />
          </View>
        ) : null}
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", zIndex: 50, backgroundColor: "rgba(16,24,40,0.38)" },
  card: { alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 24, borderRadius: radii.xl, borderWidth: 1, maxWidth: 320 },
  figure: { alignItems: "center", gap: 2 },
  caption: { fontFamily: fonts.bodyBold, fontSize: 13, textAlign: "center", writingDirection: "rtl" },
  amount: { fontFamily: fonts.display, fontSize: 40, fontWeight: "800", textAlign: "center" },
  amountCurrency: { fontSize: 24 },
  title: { fontFamily: fonts.display, fontSize: 22, fontWeight: "800", textAlign: "center", writingDirection: "rtl" },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center", writingDirection: "rtl" },
});
