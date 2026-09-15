import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { IlsAmount } from "@/components/ui/IlsAmount";
import { useAppTheme } from "@/contexts/ThemeContext";
import { isSpendableCoupon, totalRemainingValue } from "@/lib/couponTotals";
import { totalRealizedSavings } from "@/lib/couponSavings";
import { formatIls } from "@/lib/formatIls";
import { fonts, radii, shadows } from "@/lib/theme";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

/**
 * What is in the wallet, as a card rather than a caption.
 *
 * A first pass at de-emphasising this shrank it to a 13px line under the
 * search field, which is not "less prominent", it is gone. The balance is not
 * what the screen opens with any more — the search field and the companies
 * are — but it is still the number people check, and it reads as a number
 * worth checking only if it is set like one.
 *
 * Deliberately lighter than `WalletHeroCard` on the classic dashboard: no
 * greeting, no action buttons. Those live in the chips row here.
 */
export function WalletSummaryCard({
  coupons,
  isLoading,
}: {
  coupons: DecryptedCoupon[];
  isLoading?: boolean;
}) {
  const router = useRouter();
  const { theme } = useAppTheme();

  const remaining = useMemo(() => totalRemainingValue(coupons), [coupons]);
  const spendable = useMemo(() => coupons.filter(isSpendableCoupon).length, [coupons]);
  const saved = useMemo(() => totalRealizedSavings(coupons), [coupons]);

  if (isLoading && coupons.length === 0) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.navigate("/coupons")}
      accessibilityRole="button"
      accessibilityLabel={`יתרה זמינה ${formatIls(remaining)} ב-${spendable} קופונים. מעבר לכל הקופונים`}
      style={[styles.card, shadows.card, { backgroundColor: theme.card }]}
    >
      <View style={styles.main}>
        <Text style={[styles.label, { color: theme.textMuted }]}>יתרה זמינה בארנק</Text>
        <IlsAmount
          value={remaining}
          animate
          style={[styles.value, { color: theme.text }]}
          currencyStyle={styles.currency}
        />
        <Text style={[styles.sub, { color: theme.textSubtle }]}>
          {spendable === 1 ? "בקופון אחד" : `ב-${spendable} קופונים`}
          {saved > 0 ? ` · חסכת ${formatIls(saved)} עד היום` : ""}
        </Text>
      </View>
      <ChevronLeft size={18} color={theme.textSubtle} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radii.hero,
    marginBottom: 14,
  },
  main: { flex: 1, alignItems: "flex-end" },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, writingDirection: "rtl" },
  value: { fontFamily: fonts.display, fontSize: 34, fontWeight: "800", marginTop: 2 },
  currency: { fontSize: 21 },
  sub: { fontFamily: fonts.body, fontSize: 12.5, writingDirection: "rtl", marginTop: 3 },
});
