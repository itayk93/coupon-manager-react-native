import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

/**
 * Plain loading feedback for the admin screens.
 *
 * Deliberately not Kuponi. His state tracks the user's money — see
 * `docs/mascot/STATE-LAW.md` — and an admin tab fetching a table of other
 * people's rows has no money in it to track. A character animating because a
 * network request is in flight is the exact habit that wears the character out.
 */
export function AdminLoading({ label }: { label: string }) {
  const { theme } = useAppTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={styles.container}
    >
      <ActivityIndicator color={theme.primary} />
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 28, alignItems: "center", gap: 10 },
  label: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", writingDirection: "rtl" },
});
