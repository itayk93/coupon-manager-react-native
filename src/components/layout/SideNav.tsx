import React from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useInAppNotifications } from "@/hooks/useInAppNotifications";
import { useResponsive } from "@/hooks/useResponsive";
import { useAppTheme } from "@/contexts/ThemeContext";
import { buildNavItems, isNavItemActive } from "@/lib/navigation";
import { fonts, radii } from "@/lib/theme";
import { NAV_ICONS } from "./navIcons";

/**
 * Primary navigation for iPad: the same destinations as the phone's bottom
 * bar, stood up along the right edge — the side Hebrew starts from, and where
 * iPadOS puts a sidebar.
 *
 * A bar across the bottom of a 1180pt screen is a row of targets at the far
 * edge of a two-handed device, with the whole page above it left empty. The
 * rail keeps navigation where the hand holding the iPad already is, and gives
 * back the vertical room the bar was taking from every screen.
 *
 * Renders nothing on a phone — and on an iPad in a narrow Split View, where the
 * app is phone-shaped again and the bottom bar takes over.
 */
export function SideNav() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { session, isAdmin } = useAuth();
  const { navMode, navWidth } = useResponsive();
  const { data: notifications = [] } = useInAppNotifications();
  const unread = notifications.filter((item) => !item.viewed).length;

  if (navMode === "bottom") return null;
  if (!session || segments[0] === "(auth)") return null;

  const expanded = navMode === "sidebar";
  const items = buildNavItems({ isAdmin, roomy: true });

  return (
    <View
      style={[
        styles.rail,
        {
          width: navWidth,
          backgroundColor: theme.card,
          borderLeftColor: theme.cardBorder,
          // The root shell pays the top inset everywhere except native iOS,
          // where each screen still pays its own; the rail is outside those,
          // so on iOS it pays for itself.
          paddingTop: (Platform.OS === "ios" ? insets.top : 0) + 18,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.navigate("/")}
        style={[styles.brand, expanded ? styles.brandExpanded : styles.brandRail]}
        accessibilityRole="button"
        accessibilityLabel="קופון מאסטר"
      >
        <Image
          source={require("../../../public/logo-icon.png")}
          style={styles.brandMark}
          resizeMode="contain"
        />
        {expanded ? (
          <Text style={[styles.brandText, { color: theme.text }]} numberOfLines={1}>
            קופון מאסטר
          </Text>
        ) : null}
      </TouchableOpacity>

      <View style={styles.items}>
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const color = active ? theme.primary : theme.textSecondary;
          const Icon = NAV_ICONS[item.icon];
          const showBadge = item.path === "/notifications" && unread > 0;

          return (
            <TouchableOpacity
              key={item.path}
              activeOpacity={0.7}
              onPress={() => router.navigate(item.path)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              style={[
                styles.item,
                expanded ? styles.itemExpanded : styles.itemRail,
                active ? { backgroundColor: theme.primaryTint } : null,
              ]}
            >
              <View
                style={item.iconNudgeX ? { transform: [{ translateX: item.iconNudgeX }] } : undefined}
              >
                <Icon color={color} size={expanded ? 21 : 22} strokeWidth={active ? 2.2 : 1.8} />
                {showBadge ? (
                  <View style={[styles.badge, { borderColor: active ? theme.primaryTint : theme.card }]}>
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {unread >= 10 ? "10+" : unread}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  expanded ? styles.labelExpanded : styles.labelRail,
                  { color },
                  active ? styles.labelActive : null,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    // The rail sits at the right: the parent row is `row-reverse`, so it is
    // the leading child, and the border it draws is on its left.
    borderLeftWidth: 1,
    paddingHorizontal: 10,
  },
  brand: {
    alignItems: "center",
    marginBottom: 22,
  },
  brandRail: {
    gap: 6,
  },
  brandExpanded: {
    flexDirection: "row-reverse",
    gap: 10,
    paddingHorizontal: 8,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  brandText: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "800",
  },
  items: {
    gap: 6,
  },
  item: {
    borderRadius: radii.lg,
    // 44pt is the smallest target iOS calls reliable; the rail is wider than
    // that in both directions, so the tap area is the whole pill.
    minHeight: 48,
  },
  itemRail: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 5,
  },
  itemExpanded: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 12,
  },
  labelRail: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 15,
    textAlign: "center",
  },
  labelExpanded: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    fontWeight: "700",
    lineHeight: 22,
    flex: 1,
    textAlign: "right",
  },
  labelActive: {
    fontWeight: "800",
  },
  // Counter sits on the bell's left, as it does in the bottom bar.
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
    borderWidth: 1.5,
  },
  badgeText: {
    color: "#FFFFFF",
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
    includeFontPadding: false,
    textAlign: "center",
  },
});
