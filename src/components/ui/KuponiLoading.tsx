import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Kuponi } from "@/components/ui/Kuponi";
import { SpeechBubble, SPEECH_TAIL_CLEARANCE } from "@/components/ui/SpeechBubble";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

type Props = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  style?: ViewStyle;
};

/** Branded full-page loading feedback.
 *
 * Kuponi is `calm` here, not `thinking`: nothing about the user's money has
 * changed, a request is simply in flight. He waits alongside the user rather
 * than performing work. See `docs/mascot/STATE-LAW.md`. */
export function KuponiLoading({
  title = "רגע, אני מסדר הכול",
  subtitle,
  compact = false,
  style,
}: Props) {
  const { theme } = useAppTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={[title, subtitle].filter(Boolean).join(". ")}
      accessibilityLiveRegion="polite"
      style={[styles.container, compact && styles.compact, style]}
    >
      <Kuponi
        state="calm"
        size={compact ? "small" : "large"}
      />
      <View style={styles.copy}>
        <SpeechBubble text={title} tail="up" style={styles.bubble} />
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 360,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: SPEECH_TAIL_CLEARANCE,
  },
  // The tail is the same size on a compact spinner as on a full one, so the
  // room it needs does not scale down with the rest.
  compact: { flex: 0, minHeight: 190, paddingVertical: 20, gap: SPEECH_TAIL_CLEARANCE },
  copy: { alignItems: "center", gap: 8, maxWidth: 320 },
  bubble: { maxWidth: 300 },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
