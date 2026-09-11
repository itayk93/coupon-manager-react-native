import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { X } from "lucide-react-native";
import { MascotAnimation } from "@/components/ui/MascotAnimation";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

/** The 67 Easter egg is independent of the normal loading/success animations. */
export function SixSevenCelebration() {
  const { theme } = useAppTheme();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
    <MascotAnimation state="six-seven" size={132} />
    <View style={styles.copy}>
      <Text accessibilityLiveRegion="polite" style={[styles.title, { color: theme.text }]}>67 קופונים!</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>סיקס… סבן!</Text>
    </View>
    <TouchableOpacity onPress={() => setDismissed(true)} accessibilityRole="button"
      accessibilityLabel="סגירת חגיגת 67 קופונים" hitSlop={8} style={styles.close}>
      <X size={18} color={theme.textMuted} />
    </TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, padding: 12, marginBottom: 12 },
  copy: { flex: 1, alignItems: "flex-end", paddingHorizontal: 8 },
  title: { fontFamily: fonts.display, fontSize: 24, fontWeight: "800", textAlign: "right" },
  subtitle: { fontFamily: fonts.body, fontSize: 15, marginTop: 5, textAlign: "right" },
  close: { position: "absolute", top: 10, left: 10, padding: 6 },
});
