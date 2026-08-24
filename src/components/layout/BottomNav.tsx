import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, Home, MapPinned, Share2, Ticket, User } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

type Item = {
  label: string;
  path: string;
  Icon: typeof Home;
  /** Extra paths that should light this tab up. */
  match: string[];
};

// Declared right-to-left: דשבורד leads, as Hebrew expects.
const ITEMS: Item[] = [
  { label: "דשבורד", path: "/", Icon: Home, match: [] },
  { label: "קופונים", path: "/coupons", Icon: Ticket, match: ["/coupons", "/scanner"] },
  { label: "סטטיסטיקה", path: "/statistics", Icon: BarChart3, match: ["/statistics"] },
  { label: "איפה קניתי", path: "/where-bought", Icon: MapPinned, match: ["/where-bought"] },
  { label: "שיתופים", path: "/sharing", Icon: Share2, match: ["/sharing"] },
  { label: "חשבון", path: "/settings", Icon: User, match: ["/settings", "/profile", "/admin"] },
];

function isActive(item: Item, pathname: string) {
  if (item.path === "/") return pathname === "/" || pathname === "/index";
  return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/**
 * Persistent bottom navigation.
 *
 * Lives at the root rather than inside the tabs layout so it stays on every
 * screen — coupon detail, scanner, notifications and the rest — instead of
 * disappearing the moment a route is pushed. The tabs navigator's own bar is
 * hidden so there is exactly one.
 */
export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { session } = useAuth();

  // The nav belongs to the signed-in app, not the auth screens. Owning this
  // here keeps the root layout from having to thread visibility through.
  if (!session || segments[0] === "(auth)") return null;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.card,
          borderTopColor: theme.cardBorder,
          paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 18 : 10),
        },
      ]}
    >
      {ITEMS.map((item) => {
        const active = isActive(item, pathname);
        const color = active ? theme.primary : theme.textSubtle;
        return (
          <TouchableOpacity
            key={item.path}
            activeOpacity={0.7}
            onPress={() => router.navigate(item.path)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
          >
            <item.Icon color={color} size={20} strokeWidth={1.8} />
            <Text style={[styles.label, { color }]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    // row-reverse so the first item lands on the right.
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    fontWeight: "800",
    lineHeight: 15,
  },
});
