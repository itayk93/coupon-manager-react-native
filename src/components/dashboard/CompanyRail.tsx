import React, { useRef } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ShimmerLogo } from "@/components/coupons/ShimmerLogo";
import { useAppTheme } from "@/contexts/ThemeContext";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { fonts, radii } from "@/lib/theme";

/**
 * The companies you hold coupons for, as one scrolling row.
 *
 * This is the screen's fast path. Someone opening a coupon app is usually
 * standing at a till with a cashier waiting: they know the shop, and they need
 * the barcode. Naming the shop is the shortest route to it, shorter than
 * reading a balance or scrolling a list of coupons.
 *
 * Same scroll trick as `CouponRail`: laid out `row-reverse` so the first tile
 * sits on the right where Hebrew starts, then scrolled to its end on layout,
 * because a horizontal ScrollView opens at the left edge regardless.
 */

export type CompanyRailItem = { company: string; count: number };

export function CompanyRail({
  items,
  onSelect,
}: {
  items: CompanyRailItem[];
  onSelect: (company: string) => void;
}) {
  const { theme } = useAppTheme();
  const scroller = useRef<ScrollView>(null);

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={styles.content}
      >
        {items.map(({ company, count }) => (
          <TouchableOpacity
            key={company}
            activeOpacity={0.85}
            onPress={() => onSelect(company)}
            accessibilityRole="button"
            accessibilityLabel={`${company}, ${count === 1 ? "קופון אחד" : `${count} קופונים`}`}
            style={[styles.tile, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          >
            <ShimmerLogo source={getCompanyLogoSource(company)} size={40} style={styles.logo} />
            <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
              {company}
            </Text>
            <Text style={[styles.count, { color: theme.textMuted }]}>
              {count === 1 ? "קופון אחד" : `${count} קופונים`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 2, marginBottom: 8 },
  content: { flexDirection: "row-reverse", gap: 8, paddingVertical: 2 },
  tile: {
    width: 104,
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  logo: { borderRadius: 10 },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    textAlign: "center",
    writingDirection: "rtl",
  },
  count: { fontFamily: fonts.body, fontSize: 11, textAlign: "center", writingDirection: "rtl" },
});
