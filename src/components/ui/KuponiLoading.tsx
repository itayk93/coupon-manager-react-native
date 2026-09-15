import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Kuponi } from "@/components/ui/Kuponi";
import { SpeechBubble } from "@/components/ui/SpeechBubble";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

type Props = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  style?: ViewStyle;
};

/** Branded full-page loading feedback. Character motion already follows the
 * system Reduce Motion preference inside Kuponi. */
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
        state="thinking"
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
    gap: 16,
  },
  compact: { flex: 0, minHeight: 190, paddingVertical: 20, gap: 8 },
  copy: { alignItems: "center", gap: 8, maxWidth: 320 },
  bubble: { maxWidth: 300 },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
