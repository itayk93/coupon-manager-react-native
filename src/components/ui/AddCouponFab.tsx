import React from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { useAppTheme } from "@/contexts/ThemeContext";
import { shadows } from "@/lib/theme";

/**
 * Adding a coupon, from anywhere on a screen.
 *
 * It sits bottom **left**, which is the mirrored position: Material's
 * bidirectionality guidance flips the button to the left in a right-to-left
 * layout, and everything else here is already mirrored — the tab bar runs
 * `row-reverse`, the back chevron points right. A button in the bottom-right
 * would be the one thing in the app still laid out as if we read left to
 * right.
 *
 * Reach is the other half and it agrees. Roughly half of phone use is
 * one-handed and about three quarters of it is thumb work, and the bottom
 * third of the screen is the band a thumb covers without the hand shifting
 * grip — which is why the bar it sits above is down there too. Both bottom
 * corners are inside that band; the corner is a question of which way the
 * screen reads, and this one reads right to left.
 *
 * `left`, not `start`: the app calls `allowRTL` without `forceRTL`, so
 * `I18nManager.isRTL` is false on most devices and `start` would resolve to
 * the right-hand side — the opposite of the whole point.
 *
 * Bottom is measured from the screen area above the tab bar, which is a
 * sibling in the root layout rather than an overlay, so `FAB_MARGIN` is a real
 * gap between the two and not a guess at the bar's height.
 */

/** Material's 56dp circle: comfortably past the 44pt minimum touch target. */
const FAB_SIZE = 56;
/** Material's 16dp margin from the screen edges. */
const FAB_MARGIN = 16;

/**
 * What a scrolling screen should leave under its content so the button never
 * covers the end of it.
 */
export const FAB_CLEARANCE = FAB_SIZE + FAB_MARGIN * 2;

export function AddCouponFab() {
  const router = useRouter();
  const { theme } = useAppTheme();

  return (
    <PressableScale
      haptic
      // A bigger dip than a card gets: the same 3% on something this small is
      // not visible at all. See `PressableScale`.
      scaleTo={0.92}
      onPress={() => router.push("/coupons/add")}
      accessibilityRole="button"
      accessibilityLabel="הוספת קופון"
      style={[styles.fab, shadows.brand, { backgroundColor: theme.primary }]}
    >
      <Plus size={26} color="#ffffff" strokeWidth={2.6} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    left: FAB_MARGIN,
    bottom: FAB_MARGIN,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
