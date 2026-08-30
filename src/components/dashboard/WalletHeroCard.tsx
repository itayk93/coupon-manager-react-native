import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from "react-native";
import {
  WalletCards,
  CirclePlus,
  QrCode,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { isSpendableCoupon, totalRemainingValue } from "@/lib/couponTotals";
import { formatIls } from "@/lib/formatIls";
import { IlsAmount } from "@/components/ui/IlsAmount";

type WalletHeroCardProps = {
  coupons: DecryptedCoupon[];
  isLoading?: boolean;
  isError?: boolean;
};

export function WalletHeroCard({
  coupons,
  isLoading,
  isError,
}: WalletHeroCardProps) {
  const { theme } = useAppTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const visibleCoupons = coupons.filter(isSpendableCoupon);
  const totalValue = visibleCoupons.reduce((sum, c) => sum + (c.value || 0), 0);
  const remainingValue = totalRemainingValue(coupons);
  const displayName =
    user?.first_name || user?.email?.split("@")[0] || "משתמש";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "בוקר טוב" : hour < 18 ? "צהריים טובים" : "ערב טוב";

  return (
    <View style={styles.container}>
      {/* Wallet Main Card */}
      <View
        style={[
          styles.mainCard,
          { backgroundColor: theme.card },
        ]}
      >
        <View style={styles.topRow}>
          {/* Neutral on purpose: the only colour on this screen belongs to the
              button the user is meant to press. */}
          <View style={[styles.eyebrowBadge, { backgroundColor: theme.surfaceAlt }]}>
            <Text style={[styles.eyebrowText, { color: theme.textMuted }]}>הארנק שלך</Text>
            <WalletCards size={15} color={theme.textMuted} />
          </View>
        </View>

        <View style={isTablet ? styles.tabletSummaryRow : undefined}>
          <View style={isTablet ? styles.tabletGreetingGroup : undefined}>
            <Text style={[styles.greetingText, { color: theme.text }]}>
              {greeting}, {displayName} 👋
            </Text>
            <Text style={[styles.subGreetingText, { color: theme.textMuted }, isTablet && styles.tabletSubGreeting]}>
              {isError
                ? "לא הצלחנו לטעון את הקופונים"
                : visibleCoupons.length === 1 ? "קופון אחד פעיל" : `${visibleCoupons.length} קופונים פעילים`}
            </Text>
          </View>

          {/* Balance Box */}
          <View style={[
            styles.balanceBox,
            { borderTopColor: theme.divider },
            isTablet && [styles.tabletBalanceBox, { borderRightColor: theme.divider }],
          ]}>
            <Text style={[styles.balanceLabel, { color: theme.textMuted }]}>יתרה זמינה בארנק</Text>
            {isError || isLoading ? (
              <Text style={[styles.balanceValue, { color: theme.text }]}>
                {isError ? "—" : "טוען..."}
              </Text>
            ) : (
              <IlsAmount
                value={remainingValue}
                style={[styles.balanceValue, { color: theme.text }]}
                currencyStyle={styles.balanceCurrency}
              />
            )}
            <Text style={[styles.balanceSub, { color: theme.textSubtle }]}>
              {isError
                ? "היתרה תוצג לאחר טעינה מחדש"
                : `מתוך ${formatIls(totalValue)} בארנק`}
            </Text>
          </View>
        </View>

      </View>

      {/* Quick Action Buttons */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/scanner")}
          style={[
            styles.actionBtn,
            {
              backgroundColor: theme.primary,
            },
          ]}
        >
          <Text style={styles.actionBtnTextPrimary}>הוספת קופון</Text>
          <CirclePlus size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  mainCard: {
    borderRadius: radii.hero,
    padding: 18,
    ...shadows.card,
  },
  topRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  eyebrowBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
    gap: 6,
  },
  eyebrowText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: "800",
  },
  greetingText: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "right",
    marginTop: 4,
  },
  subGreetingText: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    textAlign: "right",
    marginTop: 2,
    marginBottom: 12,
  },
  balanceBox: {
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  tabletSummaryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 28,
    paddingTop: 8,
  },
  tabletGreetingGroup: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  tabletSubGreeting: {
    marginBottom: 0,
  },
  tabletBalanceBox: {
    flex: 1,
    alignItems: "flex-end",
    borderTopWidth: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 0,
    paddingRight: 28,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  balanceValue: {
    fontFamily: fonts.display,
    // Roughly 3.5x its own label, which is the ratio the pattern lives on.
    fontSize: 44,
    lineHeight: 50,
    fontWeight: "800",
    letterSpacing: -1,
  },
  balanceCurrency: {
    fontSize: 24,
    fontWeight: "700",
  },
  balanceSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 6,
  },
  actionBtnTextPrimary: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
