import React from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useCoupons } from "@/hooks/useCoupons";
import { useAppTheme } from "@/contexts/ThemeContext";
import { radii } from "@/lib/theme";

/**
 * Floating notification bell icon on top-left of the screen, replacing the
 * previous dark header bar for a clean, minimal interface.
 */
export function AppHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { data: coupons = [] } = useCoupons();

  const hasUnread = coupons.some((c) => {
    if (!c.expiration || c.status === "נוצל") return false;
    const days = (new Date(c.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 14;
  });

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : insets.top;

  return (
    <View style={[styles.floatingWrap, { top: (topInset || 12) + 8 }]} pointerEvents="box-none">
      <TouchableOpacity
        onPress={() => router.push("/notifications")}
        activeOpacity={0.8}
        style={[
          styles.floatingBell,
          {
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          },
        ]}
        accessibilityLabel="התראות"
      >
        <Bell size={20} color={theme.text} strokeWidth={1.9} />
        {hasUnread ? <View style={styles.dot} /> : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrap: {
    position: "absolute",
    left: 18,
    zIndex: 999,
  },
  floatingBell: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  dot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: "#ef4444",
  },
});
