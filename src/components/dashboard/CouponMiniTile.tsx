import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { ShimmerLogo } from "@/components/coupons/ShimmerLogo";
import { PressableScale } from "@/components/ui/PressableScale";
import { getCompanyColor, getCompanyLogoSource } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";
import { formatDateShort } from "@/lib/formatDate";
import { couponRemainingValue } from "@/lib/couponTotals";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

/**
 * A coupon at a glance, for the home screen's rails.
 *
 * Deliberately not `CouponCard`. That card is the coupons list: full width,
 * a code, a progress bar, a copy button and a usage button. A column of them
 * *is* the list screen, which is what the first version of the home screen
 * accidentally rebuilt. This shows the four things worth knowing before you
 * decide to open a coupon — who it is with, how much is left, how long you
 * have, and the brand you are looking for — in a tile narrow enough that the
 * next one is already visible beside it.
 *
 * Tap opens the coupon; a long press reports usage, the same two actions the
 * card offers.
 */

const TILE_WIDTH = 150;

type CouponMiniTileProps = {
  coupon: DecryptedCoupon;
  /** Whole days to expiry. Shown only when the caller has a reason to. */
  days?: number | null;
  onPress: () => void;
  onReportUsage?: () => void;
};

function daysLabel(days: number): string {
  if (days <= 0) return "פג היום";
  if (days === 1) return "פג מחר";
  if (days === 2) return "פג בעוד יומיים";
  return `פג בעוד ${days} ימים`;
}

export function CouponMiniTile({ coupon, days, onPress, onReportUsage }: CouponMiniTileProps) {
  const { theme } = useAppTheme();
  const brand = getCompanyColor(coupon.company || "");
  const remaining = couponRemainingValue(coupon);
  const showDays = typeof days === "number";
  const validUntil = formatDateShort(coupon.expiration);
  // The tone escalates only inside the week; past that a date is enough.
  const tone = !showDays
    ? null
    : days! <= 1
      ? { bg: theme.dangerBg, text: theme.dangerText }
      : days! <= 7
        ? { bg: theme.warningBg, text: theme.warningText }
        : { bg: theme.neutralBg, text: theme.neutralText };

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onReportUsage}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${coupon.company || "קופון"}, נותרו ${formatIls(remaining)}${
        showDays ? `, ${daysLabel(days!)}` : ""
      }`}
      style={[
        styles.tile,
        shadows.card,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
      ]}
    >
      {/* The brand's own colour rings the logo: a cue you can find in a rail
          without reading, and without a loose dot floating off to the side. */}
      <View style={[styles.logoWrap, { borderColor: brand }]}>
        <ShimmerLogo source={getCompanyLogoSource(coupon.company)} size={34} />
      </View>

      <Text style={[styles.company, { color: theme.text }]} numberOfLines={1}>
        {coupon.company || "ללא חברה"}
      </Text>
      <Text style={[styles.amount, { color: theme.text }]} numberOfLines={1}>
        {formatIls(remaining)}
      </Text>

      {tone ? (
        <View style={[styles.daysPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.daysText, { color: tone.text }]} numberOfLines={1}>
            {daysLabel(days!)}
          </Text>
        </View>
      ) : (
        // Not a filler line: on the "recently used" rail the useful thing to
        // know about a coupon nobody is chasing is how long it is good for.
        <Text style={[styles.subtle, { color: theme.textMuted }]} numberOfLines={1}>
          {validUntil ? `בתוקף עד ${validUntil}` : "בלי תאריך תפוגה"}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE_WIDTH,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 12,
    alignItems: "flex-end",
    gap: 2,
  },
  logoWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  company: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    alignSelf: "stretch",
  },
  amount: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
    alignSelf: "stretch",
  },
  daysPill: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: "100%",
  },
  daysText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: "700",
  },
  subtle: {
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 8,
    textAlign: "right",
    alignSelf: "stretch",
  },
});
