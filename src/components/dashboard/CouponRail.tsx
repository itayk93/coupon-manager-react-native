import React, { useRef } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { CouponMiniTile } from "@/components/dashboard/CouponMiniTile";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

/**
 * One titled, horizontally scrolling row of coupons.
 *
 * The scroll position is the fiddly part. The row is laid out `row-reverse` so
 * the first coupon sits on the right, where Hebrew starts — but a horizontal
 * ScrollView still opens at content offset 0, which is the *left* edge, i.e.
 * the end of the row. Left alone, a rail sorted most-urgent-first opens on its
 * least urgent tile and the urgent ones are off screen. `scrollToEnd` on the
 * first layout puts the beginning of the row in view, the same trick the admin
 * tab rail uses.
 */

export type RailItem = { coupon: DecryptedCoupon; days?: number | null };

type CouponRailProps = {
  title: string;
  items: RailItem[];
  onOpen: (coupon: DecryptedCoupon) => void;
  onReportUsage?: (coupon: DecryptedCoupon) => void;
  /** Prefix for the tile keys, so two rails can hold the same coupon. */
  keyPrefix: string;
};

export function CouponRail({ title, items, onOpen, onReportUsage, keyPrefix }: CouponRailProps) {
  const { theme } = useAppTheme();
  const scroller = useRef<ScrollView>(null);

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={styles.content}
        style={styles.rail}
      >
        {items.map(({ coupon, days }) => (
          <CouponMiniTile
            key={`${keyPrefix}-${coupon.id}`}
            coupon={coupon}
            days={days}
            onPress={() => onOpen(coupon)}
            onReportUsage={onReportUsage ? () => onReportUsage(coupon) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 6,
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  // The rail bleeds into the screen's padding, so a tile is cut off at the edge
  // rather than ending neatly — which is what says "this scrolls".
  rail: {
    marginHorizontal: -16,
  },
  content: {
    flexDirection: "row-reverse",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
});
