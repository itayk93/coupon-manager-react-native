import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useInAppNotifications } from "@/hooks/useInAppNotifications";
import { useResponsive } from "@/hooks/useResponsive";
import { useAppTheme } from "@/contexts/ThemeContext";
import { buildNavItems, isNavItemActive } from "@/lib/navigation";
import { fonts } from "@/lib/theme";
import { NAV_ICONS } from "./navIcons";

/**
 * Persistent bottom navigation.
 *
 * Lives at the root rather than inside the tabs layout so it stays on every
 * screen — coupon detail, scanner, notifications and the rest — instead of
 * disappearing the moment a route is pushed. The tabs navigator's own bar is
 * hidden so there is exactly one.
 *
 * On an iPad the same destinations move to `SideNav`, so this returns null
 * there — the two are never on screen together.
 */
export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { session, isAdmin } = useAuth();
  const { navMode } = useResponsive();
  const { data: notifications = [] } = useInAppNotifications();
  const unread = notifications.filter((item) => !item.viewed).length;
  const items = buildNavItems({ isAdmin });

  if (navMode !== "bottom") return null;
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
      {Platform.OS === "android" ? (
        <View
          pointerEvents="none"
          style={[
            styles.systemNavSeparator,
            { bottom: insets.bottom, backgroundColor: theme.border },
          ]}
        />
      ) : null}
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);
        const color = active ? theme.primary : theme.textSubtle;
        const Icon = NAV_ICONS[item.icon];
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
            <View style={item.iconNudgeX ? { transform: [{ translateX: item.iconNudgeX }] } : undefined}>
              <Icon color={color} size={20} strokeWidth={1.8} />
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
    position: "relative",
  },
  systemNavSeparator: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
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
