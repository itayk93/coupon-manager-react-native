import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter, useSegments } from "expo-router";
import { PressableScale } from "@/components/ui/PressableScale";
import { useNativeDriver } from "@/lib/animation";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Plus, Share2, Ticket, User } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useResponsive } from "@/hooks/useResponsive";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
import { emitTabRetap } from "@/lib/tabBarRetap";

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
  // On a tablet these same destinations live in `SideNav`, so this draws
  // nothing rather than doubling them. Both components stay mounted across the
  // breakpoint; only one of them ever renders.
  const { navMode } = useResponsive();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { session } = useAuth();
  const items = buildItems();

  // Native tab bars give two quiet behaviors this custom bar has to supply
  // itself: a selection tick, and scroll-to-top when the active tab is tapped
  // again. The haptic fires only when something actually happens — a real tab
  // change, or the re-tap signal a list screen turns into a scroll.
  const handlePress = (item: Item, active: boolean) => {
    void Haptics.selectionAsync().catch(() => {});
    if (active) {
      emitTabRetap(item.path);
    } else {
      router.navigate(item.path);
    }
  };

  if (!session || segments[0] === "(auth)") return null;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          // Pill floats just above the home indicator (iOS 26 style); the safe
          // area is outside the card, not padding inside it.
          marginBottom: Math.max(insets.bottom - 6, 10),
        },
      ]}
    >
      {items.map((item) => {
        const active = isActive(item, pathname);

        if (item.primary) {
          return (
            <PressableScale
              key={item.path}
              scaleTo={0.9}
              onPress={() => handlePress(item, active)}
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
            </PressableScale>
          );
        }

        const color = active ? theme.primary : theme.textSubtle;
        return (
          <PressableScale
            key={item.path}
            scaleTo={0.94}
            onPress={() => handlePress(item, active)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
          >
            {/*
              Active tab reads as one tinted capsule wrapping the same
              icon-over-label stack the inactive tabs use (reference: the
              lime pill), so the label always gets its full width and the
              pill never fights four neighbours for room.
            */}
            <View
              style={[
                active
                  ? [styles.activePill, { backgroundColor: `${theme.primary}1F` }]
                  : styles.itemStack,
              ]}
            >
              <NavIcon Icon={item.Icon} color={color} active={active} nudgeX={item.iconNudgeX} />
              <Text style={[styles.label, { color }]} numberOfLines={1}>{item.label}</Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

type NavIconProps = {
  Icon: React.ComponentType<{ color: string; size: number; strokeWidth: number }>;
  color: string;
  active: boolean;
  nudgeX?: number;
};

/**
 * Tab icon with the tab-switch animation from the motion reference: when a
 * tab becomes active its icon "lands" — it starts slightly shrunk and
 * springs to full size. Inactive tabs stay put, so the pop reads as the
 * bar acknowledging the switch rather than the whole row wiggling.
 */
function NavIcon({ Icon, color, active, nudgeX }: NavIconProps) {
  const reduceMotion = useReduceMotion();
  const scale = React.useRef(new Animated.Value(1)).current;
  const wasActive = React.useRef(active);

  React.useEffect(() => {
    if (active && !wasActive.current && !reduceMotion) {
      scale.setValue(0.7);
      Animated.spring(scale, {
        toValue: 1,
        damping: 11,
        stiffness: 320,
        mass: 0.5,
        useNativeDriver,
      }).start();
    }
    wasActive.current = active;
  }, [active, reduceMotion, scale]);

  return (
    <Animated.View
      style={{
        transform: [{ scale }, ...(nudgeX ? [{ translateX: nudgeX }] : [])],
      }}
    >
      <Icon color={color} size={20} strokeWidth={2.2} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    // row-reverse so the first item lands on the right.
    flexDirection: "row-reverse",
    // Floating card: detached from the screen edges, rounded, lifted by a
    // soft shadow (reference mock) rather than a docked strip with a rule.
    marginHorizontal: 20,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  itemStack: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  activePill: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 26,
  },
  item: {
    flex: 1,
    // Flex children keep their content's minimum width unless told otherwise;
    // without this the active pill's label pushes the whole slot wider.
    minWidth: 0,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  // Sits inside the bar rather than lifted above it: a disc hanging over the
  // top edge needs the bar to not clip, which Android does not promise.
  // Colour and shape carry the emphasis instead of geometry.
  primaryDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
