import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CouponCard } from "@/components/coupons/CouponCard";
import { useContentWidth } from "@/hooks/useContentWidth";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

/**
 * One titled section of coupons, a card per row.
 *
 * The card is `CouponCard` — the same one the coupons list and the dashboard
 * render — for the same reason the home screen imports its ordering rather than
 * re-inventing it: a coupon should not look like one thing here and another
 * everywhere else. The section earns its place by being short, not by drawing
 * the coupon differently; the caller decides how many cards it holds.
 *
 * Two to a row on a tablet, at the width the dashboard already gives its
 * favourites, so the cards do not stretch to the full width of an iPad.
 */

const TABLET_MIN_WIDTH = 768;

type CouponSectionProps = {
  title: string;
  coupons: DecryptedCoupon[];
  /** Tags by coupon id, passed straight through to the card. */
  tagsMap?: Record<string, string[]>;
  onOpen: (coupon: DecryptedCoupon) => void;
  onReportUsage?: (coupon: DecryptedCoupon) => void;
  /** Prefix for the card keys, so two sections can hold the same coupon. */
  keyPrefix: string;
};

export function CouponSection({
  title,
  coupons,
  tagsMap = {},
  onOpen,
  onReportUsage,
  keyPrefix,
}: CouponSectionProps) {
  const { theme } = useAppTheme();
  const isTablet = useContentWidth() >= TABLET_MIN_WIDTH;

  if (coupons.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <View style={isTablet ? styles.tabletGrid : undefined}>
        {coupons.map((coupon) => (
          <View
            key={`${keyPrefix}-${coupon.id}`}
            style={isTablet ? styles.tabletColumn : undefined}
          >
            <CouponCard
              coupon={coupon}
              tags={tagsMap[coupon.id] || []}
              onPress={() => onOpen(coupon)}
              onReportUsage={onReportUsage ? () => onReportUsage(coupon) : undefined}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 6,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  // `CouponCard` carries its own bottom margin, so the stack needs no gap of
  // its own — only the tablet row does, between the two columns.
  tabletGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
  },
  tabletColumn: {
    width: "49%",
    minWidth: 0,
  },
});
