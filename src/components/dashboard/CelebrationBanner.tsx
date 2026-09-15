import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { X } from "lucide-react-native";
import { useCelebration } from "@/hooks/useCelebration";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

/**
 * The milestone scene, in the app rather than only on the widget.
 *
 * Art comes from `assets/mascot/celebration/app/`, the downscaled WebP copies
 * the app bundles; the 1254px production PNGs are 19MB and stay out of the
 * JS bundle. `scripts/prepare-celebration-app.py` regenerates them.
 */
const SCENES: Record<string, ReturnType<typeof require>> = {
  anniversary: require("../../../assets/mascot/celebration/app/C1-anniversary.webp"),
  milestone: require("../../../assets/mascot/celebration/app/C2-coupon-milestone.webp"),
  savings: require("../../../assets/mascot/celebration/app/C3-lifetime-savings.webp"),
  redeemed: require("../../../assets/mascot/celebration/app/C3-lifetime-savings.webp"),
  monthly: require("../../../assets/mascot/celebration/app/C4-monthly-recap.webp"),
  rescue: require("../../../assets/mascot/celebration/app/C6-last-minute-rescue.webp"),
  clean: require("../../../assets/mascot/celebration/app/C7-clean-month.webp"),
  referral: require("../../../assets/mascot/celebration/app/C8-referral-joined.webp"),
  record: require("../../../assets/mascot/celebration/app/C9-wallet-record.webp"),
};

/** Dismissals last the session; a scene only lives until local midnight anyway. */
const dismissed = new Set<string>();

export function CelebrationBanner() {
  const { theme } = useAppTheme();
  const scene = useCelebration();
  const [, forceRender] = useState(0);

  // 6-7 has its own animated banner, which beats a still frame of the same joke.
  if (!scene || scene.kind === "six-seven") return null;
  const source = SCENES[scene.kind];
  if (!source) return null;

  const id = `${scene.kind}:${scene.until ?? ""}`;
  if (dismissed.has(id)) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <Image source={source} style={styles.scene} accessible={false} resizeMode="cover" />
      <View style={styles.copy}>
        <Text accessibilityLiveRegion="polite" style={[styles.title, { color: theme.text }]}>
          {scene.text}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => { dismissed.add(id); forceRender((n) => n + 1); }}
        accessibilityRole="button"
        accessibilityLabel="סגירת החגיגה"
        hitSlop={8}
        style={styles.close}
      >
        <X size={18} color={theme.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, padding: 12, marginBottom: 12 },
  scene: { width: 96, height: 96, borderRadius: 14 },
  copy: { flex: 1, alignItems: "flex-end", paddingHorizontal: 12 },
  title: { fontFamily: fonts.display, fontSize: 19, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  close: { position: "absolute", top: 10, left: 10, padding: 6 },
});
