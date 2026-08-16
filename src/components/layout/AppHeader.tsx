import React from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useCoupons } from "@/hooks/useCoupons";
import { fonts, palette, radii } from "@/lib/theme";

/**
 * The app shell header from the redesign: a fixed dark bar carrying the brand
 * mark, a notification bell with an unread dot, and the account avatar.
 * Rendered once above the tab navigator rather than per screen.
 */
export function AppHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: coupons = [] } = useCoupons();

  const hasUnread = coupons.some((c) => {
    if (!c.expiration || c.status === "נוצל") return false;
    const days = (new Date(c.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 14;
  });

  const initials =
    `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.trim() ||
    (user?.email?.[0] || "U").toUpperCase();

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : insets.top;

  return (
    <View style={[styles.wrap, { paddingTop: topInset }]}>
      <View style={styles.bar}>
        <TouchableOpacity
          onPress={() => router.navigate("/(tabs)")}
          activeOpacity={0.8}
          style={styles.brand}
        >
          <View style={styles.mark} />
          <Text style={styles.brandText}>קופון מאסטר</Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => router.push("/profile")}
            activeOpacity={0.8}
            style={styles.avatar}
            accessibilityLabel="פרופיל"
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/notifications")}
            activeOpacity={0.8}
            style={styles.bellBtn}
            accessibilityLabel="התראות"
          >
            <Bell size={21} color="#ffffff" strokeWidth={1.8} />
            {hasUnread ? <View style={styles.dot} /> : null}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: palette.headerBg,
  },
  bar: {
    height: 60,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  brand: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  mark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: palette.primary,
  },
  brandText: {
    fontFamily: fonts.display,
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 18,
  },
  bellBtn: {
    padding: 4,
  },
  dot: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 9,
    height: 9,
    borderRadius: radii.pill,
    backgroundColor: "#ef4444",
    borderWidth: 2,
    borderColor: palette.headerBg,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: palette.primary,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fonts.bodyBold,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
