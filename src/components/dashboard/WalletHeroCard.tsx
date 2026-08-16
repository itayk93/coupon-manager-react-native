import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  WalletCards,
  Sparkles,
  BarChart3,
  CirclePlus,
  ListChecks,
} from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import { DecryptedCoupon } from "@/hooks/useCoupons";

type WalletHeroCardProps = {
  coupons: DecryptedCoupon[];
  isLoading?: boolean;
  isError?: boolean;
  onQuickAdd: () => void;
  onViewStats: () => void;
};

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

export function WalletHeroCard({
  coupons,
  isLoading,
  isError,
  onQuickAdd,
  onViewStats,
}: WalletHeroCardProps) {
  const { theme } = useAppTheme();
  const { user } = useAuth();

  const visibleCoupons = coupons.filter(
    (c) => !c.is_for_sale && c.status !== "נוצל"
  );
  const totalValue = visibleCoupons.reduce((sum, c) => sum + (c.value || 0), 0);
  const usedValue = visibleCoupons.reduce(
    (sum, c) => sum + (c.used_value || 0),
    0
  );
  const remainingValue = totalValue - usedValue;
  const totalSavings = visibleCoupons.reduce(
    (sum, c) => sum + Math.max(0, (c.value || 0) - (c.cost || 0)),
    0
  );

  const expiringSoonCount = visibleCoupons.filter((c) => {
    if (!c.expiration) return false;
    const daysLeft =
      (new Date(c.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft >= 0 && daysLeft <= 14;
  }).length;

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
          {
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <View style={styles.topRow}>
          <View style={[styles.eyebrowBadge, { backgroundColor: theme.primaryTint }]}>
            <Text style={[styles.eyebrowText, { color: theme.primaryDark }]}>הארנק שלך</Text>
            <WalletCards size={15} color={theme.primaryDark} />
          </View>
        </View>

        <Text style={[styles.greetingText, { color: theme.text }]}>
          {greeting}, {displayName} 👋
        </Text>
        <Text style={[styles.subGreetingText, { color: theme.textMuted }]}>
          {isError
            ? "לא הצלחנו לטעון את הקופונים"
            : `${visibleCoupons.length} קופונים פעילים לניצול`}
        </Text>

        {/* Balance Box */}
        <View
          style={[
            styles.balanceBox,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.balanceLabel, { color: theme.textMuted }]}>יתרה זמינה בארנק</Text>
          <Text style={[styles.balanceValue, { color: theme.text }]}>
            {isError ? "—" : isLoading ? "טוען..." : formatIls(remainingValue)}
          </Text>
          <Text style={[styles.balanceSub, { color: theme.textSubtle }]}>
            {isError
              ? "היתרה תוצג לאחר טעינה מחדש"
              : `מתוך ${formatIls(totalValue)} בארנק`}
          </Text>
        </View>

      </View>

      {/* Stat tiles */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <BarChart3 size={18} color={theme.warning} />
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>פגים ב-14 יום</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {isLoading || isError ? "—" : expiringSoonCount}
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Sparkles size={18} color={theme.success} />
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>חסכת עד היום</Text>
          <Text style={[styles.statValue, { color: theme.success }]}>
            {isLoading || isError ? "—" : formatIls(totalSavings)}
          </Text>
        </View>
      </View>

      {/* Quick Action Buttons */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onQuickAdd}
          style={[styles.actionBtn, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.actionBtnTextPrimary}>הוספת קופון מהירה</Text>
          <CirclePlus size={18} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onViewStats}
          style={[
            styles.actionBtn,
            {
              backgroundColor: theme.card,
              borderColor: theme.inputBorder,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[styles.actionBtnText, { color: theme.text }]}>
            על מה חסכת?
          </Text>
          <ListChecks size={18} color={theme.text} />
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  mainCard: {
    borderRadius: radii.hero,
    padding: 22,
    borderWidth: 1,
    ...shadows.card,
  },
  topRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
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
    fontSize: 26,
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
    marginBottom: 16,
  },
  balanceBox: {
    borderRadius: radii.card,
    padding: 18,
    alignItems: "flex-end",
    marginBottom: 14,
    borderWidth: 1,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  balanceValue: {
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: "800",
  },
  balanceSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row-reverse",
    gap: 14,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 16,
    alignItems: "flex-end",
    gap: 6,
    ...shadows.card,
  },
  statLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "800",
  },
  actionButtonsRow: {
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 16,
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
