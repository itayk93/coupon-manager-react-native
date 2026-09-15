import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Plus, Share2, Ticket, User } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

type Item = {
  label: string;
  path: string;
  Icon: typeof Home;
  /** Extra paths that should light this tab up. */
  match: string[];
  /**
   * Optical-centering nudge, in pixels. Most lucide glyphs are centered in
   * their 24px box; `share-2` is drawn ~3 units left of center, so it reads
   * offset under its label without this.
   */
  iconNudgeX?: number;
  /**
   * The one action the bar is built around. Drawn as a filled disc instead of
   * an icon-and-label pair, so that of the five things down here exactly one
   * is dressed to be pressed.
   */
  primary?: boolean;
};

// Declared right-to-left: דשבורד leads, as Hebrew expects.
//
// Five slots, and the middle one is the add button rather than a destination.
// Six destinations is over the point where a bar stops being scanned and
// starts being read, and two of the six ("שיתופים" / "שותפים") differed by a
// single letter at 9.5pt — the reader had to decode before choosing.
//
// What left: התראות is the bell on the wallet card, and שותפים, סטטיסטיקה and
// "איפה קניתי" are all reached from חשבון. None of them is somewhere people go
// mid-task.
function buildItems(): Item[] {
  return [
    { label: "דשבורד", path: "/", Icon: Home, match: [] },
    { label: "קופונים", path: "/coupons", Icon: Ticket, match: ["/coupons"] },
    { label: "הוספת קופון", path: "/scanner", Icon: Plus, match: ["/scanner"], primary: true },
    { label: "שיתופים", path: "/sharing", Icon: Share2, match: ["/sharing"], iconNudgeX: 2.5 },
    {
      label: "חשבון",
      path: "/settings",
      Icon: User,
      match: ["/settings", "/profile", "/admin", "/invite", "/referral-program"],
    },
  ];
}

function isActive(item: Item, pathname: string) {
  if (item.path === "/") return pathname === "/" || pathname === "/index";
  // item.path may carry a query string; matching is on `match` alone.
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
  const items = buildItems();

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
        const active = isActive(item, pathname);

        if (item.primary) {
          return (
            <TouchableOpacity
              key={item.path}
              activeOpacity={0.85}
              onPress={() => router.navigate(item.path)}
              style={styles.item}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
            >
              <View
                style={[
                  styles.primaryDisc,
                  { backgroundColor: active ? theme.primaryDark : theme.primary },
                ]}
              >
                <item.Icon color="#ffffff" size={26} strokeWidth={2.6} />
              </View>
            </TouchableOpacity>
          );
        }

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
            <View style={item.iconNudgeX ? { transform: [{ translateX: item.iconNudgeX }] } : undefined}>
              <item.Icon color={color} size={20} strokeWidth={1.8} />
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
  // Sits inside the bar rather than lifted above it: a disc hanging over the
  // top edge needs the bar to not clip, which Android does not promise.
  // Colour and shape carry the emphasis instead of geometry.
  primaryDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    fontWeight: "800",
    lineHeight: 15,
  },
});
