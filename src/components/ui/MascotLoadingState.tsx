import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { CharacterSpotlight } from "@/components/onboarding/CharacterRig";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

type Props = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  style?: ViewStyle;
};

/** Branded full-page loading feedback. Character motion already follows the
 * system Reduce Motion preference inside CharacterSpotlight. */
export function MascotLoadingState({
  title = "רק רגע, כבר מסדרים הכול",
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
      <CharacterSpotlight
        character="helper"
        state="thinking"
        size={compact ? "small" : "large"}
        tone="mint"
      />
      <View style={styles.copy}>
        <Text style={[styles.title, compact && styles.compactTitle, { color: theme.text }]}>
          {title}
        </Text>
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
  copy: { alignItems: "center", gap: 6, maxWidth: 320 },
  title: { fontFamily: fonts.display, fontSize: 19, fontWeight: "800", textAlign: "center" },
  compactTitle: { fontSize: 16 },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
