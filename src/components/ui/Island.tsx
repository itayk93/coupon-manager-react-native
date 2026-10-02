import React from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import { Sparkles } from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
import { pushToast } from "@/components/ui/Toast";

/**
 * A notification that grows out of the Dynamic Island, for the moments the
 * smart parser has something to tell the user while they are in the app.
 *
 * The animation is `components/dynamic-notifications`, vendored from
 * rit3zh/expo-dynamic-notifications. It only makes sense on an iPhone that has
 * an island to grow out of, so everywhere else — Android, web, iPad, a notch —
 * `pushIsland` falls back to the ordinary success toast and the caller does not
 * have to care which one the user got. Everywhere else — Android, web, iPad,
 * a notch — `LiteIslandHost` plays a light imitation with plain Animated: a
 * black pill at the top that grows into the card and shrinks back. No Skia.
 * The toast is left only for the moment before any host has mounted.
 */

export type IslandPayload = {
  title: string;
  message?: string;
  onPress?: () => void;
  /** Kuponi's face for a push; without one the card shows the smart-parser sparkle. */
  face?: ImageSourcePropType;
};

type Listener = (island: IslandPayload) => void;

let listener: Listener | null = null;

/** Whether `pushIsland` will reach the island rather than fall back to a toast. */
export function hasIslandHost(): boolean {
  return listener !== null;
}

export function pushIsland(island: IslandPayload) {
  if (listener) {
    listener(island);
    return;
  }
  pushToast("success", island.title, island.message);
}

/**
 * Decided once, at launch, from the insets the app started with: an island
 * iPhone's top inset is 54pt or more, a notch's is 50 at most. Read once so a
 * rotation to landscape (top inset 0) cannot unmount the host mid-animation.
 */
const HAS_DYNAMIC_ISLAND =
  Platform.OS === "ios" && !Platform.isPad && (initialWindowMetrics?.insets.top ?? 0) >= 54;

type IslandLib = typeof import("@/components/dynamic-notifications");

let lib: IslandLib | null | undefined;

/**
 * Loaded on demand rather than imported, the same way the scanner loads
 * expo-image-picker: Skia, expo-blur, expo-image and expo-symbols are native
 * modules that throw while being evaluated on a binary built before they were
 * added, and runtimeVersion is fixed, so an OTA update does reach those
 * binaries. A missing module turns into the toast fallback, not a crash.
 */
function loadIslandLib(): IslandLib | null {
  if (lib === undefined) {
    try {
      lib = require("../dynamic-notifications") as IslandLib;
    } catch (error) {
      console.warn("Dynamic Island notifications unavailable in this build:", error);
      lib = null;
    }
  }
  return lib;
}

function IslandCard({ island }: { island: IslandPayload }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.card}>
      {island.face ? (
        <Image source={island.face} style={styles.face} />
      ) : (
        <View style={[styles.badge, { backgroundColor: theme.primaryTint }]}>
          <Sparkles size={22} color={theme.primary} />
        </View>
      )}
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
          {island.title}
        </Text>
        {island.message ? (
          <Text numberOfLines={1} style={[styles.message, { color: theme.textMuted }]}>
            {island.message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Lives inside the library's provider and hands its `trigger` to `pushIsland`. */
function IslandBridge({ islandLib }: { islandLib: IslandLib }) {
  const { trigger } = islandLib.useDynamicNotifications();

  React.useEffect(() => {
    listener = (island) => {
      trigger({
        title: island.title,
        message: island.message,
        onPress: island.onPress,
        render: () => <IslandCard island={island} />,
      });
      AccessibilityInfo.announceForAccessibility(
        [island.title, island.message].filter(Boolean).join(". "),
      );
    };
    return () => {
      listener = null;
    };
  }, [trigger]);

  return null;
}

const LITE_PILL = { width: 120, height: 34 };
const LITE_CARD_HEIGHT = 72;
const LITE_HOLD_MS = 3500;
const useNativeDriver = false; // width/height/color cannot use the native driver

/**
 * The island everywhere there is no real one: one card at a time, a newer push
 * replaces the one showing. Tapping runs `onPress` and closes it.
 */
function LiteIslandHost() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [island, setIsland] = React.useState<IslandPayload | null>(null);
  const grow = React.useRef(new Animated.Value(0)).current;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cardWidth, setCardWidth] = React.useState(0);

  const close = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(grow, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver })
      .start(({ finished }) => finished && setIsland(null));
  }, [grow]);

  React.useEffect(() => {
    listener = (next) => {
      if (timer.current) clearTimeout(timer.current);
      grow.stopAnimation();
      grow.setValue(0);
      setIsland(next);
      Animated.spring(grow, { toValue: 1, damping: 16, stiffness: 170, mass: 0.9, useNativeDriver }).start();
      timer.current = setTimeout(close, LITE_HOLD_MS);
      AccessibilityInfo.announceForAccessibility([next.title, next.message].filter(Boolean).join(". "));
    };
    return () => {
      listener = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [grow, close]);

  const width = cardWidth || 360;
  return (
    <View
      style={[styles.liteHost, { top: insets.top + (Platform.OS === "web" ? 8 : 4), pointerEvents: "box-none" }]}
      onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
    >
      {island ? (
        <Animated.View
          style={[
            styles.lite,
            {
              width: grow.interpolate({ inputRange: [0, 1], outputRange: [LITE_PILL.width, width] }),
              height: grow.interpolate({ inputRange: [0, 1], outputRange: [LITE_PILL.height, LITE_CARD_HEIGHT] }),
              borderRadius: grow.interpolate({ inputRange: [0, 1], outputRange: [LITE_PILL.height / 2, 26] }),
              backgroundColor: grow.interpolate({ inputRange: [0, 0.6, 1], outputRange: ["#000000", "#000000", theme.card] }),
              opacity: grow.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 1, 1], extrapolate: "clamp" }),
            },
          ]}
        >
          <Pressable
            style={styles.litePress}
            onPress={() => {
              island.onPress?.();
              close();
            }}
          >
            <Animated.View style={[styles.liteCopy, { opacity: grow.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1], extrapolate: "clamp" }) }]}>
              <IslandCard island={island} />
            </Animated.View>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Mounted once at the root, above the toasts. */
export function IslandHost() {
  const { theme } = useAppTheme();
  const islandLib = HAS_DYNAMIC_ISLAND ? loadIslandLib() : null;
  if (!islandLib) return <LiteIslandHost />;

  const { DynamicNotifications } = islandLib;
  return (
    <DynamicNotifications
      style={styles.host}
      cardColor={theme.card}
      accent={theme.primary}
    >
      <IslandBridge islandLib={islandLib} />
    </DynamicNotifications>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10000,
    pointerEvents: "box-none",
  },
  liteHost: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 10000,
    alignItems: "center",
    ...(Platform.OS === "web" ? { maxWidth: 430, marginHorizontal: "auto" } : null),
  },
  lite: {
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  litePress: {
    flex: 1,
  },
  liteCopy: {
    flex: 1,
  },
  card: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingRight: 13,
    paddingLeft: 20,
    gap: 12,
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  copy: {
    flex: 1,
    alignItems: "flex-end",
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    textAlign: "right",
    marginTop: 1,
  },
});
