import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Home, Share2, Ticket, User } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useInAppNotifications } from "@/hooks/useInAppNotifications";
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
//
// Statistics and "איפה קניתי" are reached from the account page rather than
// from here: six bars left each label under ten points of type, and neither
// screen is somewhere people go mid-task.
const ITEMS: Item[] = [
  { label: "דשבורד", path: "/", Icon: Home, match: [] },
  { label: "קופונים", path: "/coupons", Icon: Ticket, match: ["/coupons", "/scanner"] },
  { label: "שיתופים", path: "/sharing", Icon: Share2, match: ["/sharing"] },
  { label: "התראות", path: "/notifications", Icon: Bell, match: ["/notifications"] },
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
  const { data: notifications = [] } = useInAppNotifications();
  const unread = notifications.filter((item) => !item.viewed).length;

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
            <View>
              <item.Icon color={color} size={20} strokeWidth={1.8} />
              {item.path === "/notifications" && unread > 0 ? (
                <View style={[styles.badge, { borderColor: theme.card }]}>
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {unread >= 10 ? "10+" : unread}
                  </Text>
                </View>
              ) : null}
            </View>
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
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  // Counter sits on the bell's left, per the design. It is a pill rather than
  // a circle so "10+" widens instead of spilling out of a fixed disc.
  badge: {
    position: "absolute",
    top: -7,
    left: -15,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    paddingHorizontal: 4,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    // A ring in the bar's own color keeps the badge legible where it laps the
    // bell's outline.
    borderWidth: 1.5,
  },
  badgeText: {
    color: "#FFFFFF",
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    fontWeight: "800",
    // lineHeight matched to the pill and font padding off: the default Android
    // padding pushes the digits below the center.
    lineHeight: 11,
    includeFontPadding: false,
    textAlign: "center",
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    fontWeight: "800",
    lineHeight: 15,
  },
});
