import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  WalletCards,
  Sparkles,
  ReceiptText,
  BarChart3,
  CirclePlus,
  ListChecks,
} from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { DecryptedCoupon } from "@/hooks/useCoupons";

type WalletHeroCardProps = {
  coupons: DecryptedCoupon[];
  isLoading?: boolean;
  isError?: boolean;
  onQuickAdd: () => void;
  onViewStats: () => void;
  onReportUsage: () => void;
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
  onReportUsage,
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
            backgroundColor: theme.isDark ? "#0f172a" : "#1e293b",
            borderColor: theme.isDark ? "#1e293b" : "#334155",
          },
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.eyebrowBadge}>
            <Text style={styles.eyebrowText}>הארנק שלך</Text>
            <WalletCards size={16} color="#34d399" />
          </View>
        </View>

        <Text style={styles.greetingText}>
          {greeting}, {displayName} 👋
        </Text>
        <Text style={styles.subGreetingText}>
          {isError
            ? "לא הצלחנו לטעון את הקופונים"
            : `${visibleCoupons.length} קופונים פעילים לניצול`}
        </Text>

        {/* Balance Box */}
        <View
          style={[
            styles.balanceBox,
            { backgroundColor: theme.isDark ? "#1e293b" : "#0f172a" },
          ]}
        >
          <Text style={styles.balanceLabel}>יתרה זמינה בארנק</Text>
          <Text style={styles.balanceValue}>
            {isError ? "—" : isLoading ? "טוען..." : formatIls(remainingValue)}
          </Text>
          <Text style={styles.balanceSub}>
            {isError
              ? "היתרה תוצג לאחר טעינה מחדש"
              : `מתוך ${formatIls(totalValue)} בארנק`}
          </Text>
        </View>

        {/* KPI Mini Grid */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>פגים ב-14 יום</Text>
              <BarChart3 size={15} color="#f59e0b" />
            </View>
            <Text style={[styles.kpiValue, { color: "#fbbf24" }]}>
              {isLoading || isError ? "—" : expiringSoonCount}
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>כבר נוצל</Text>
              <ReceiptText size={15} color="#60a5fa" />
            </View>
            <Text style={[styles.kpiValue, { color: "#93c5fd" }]}>
              {isLoading || isError ? "—" : formatIls(usedValue)}
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>חסכת עד היום</Text>
              <Sparkles size={15} color="#34d399" />
            </View>
            <Text style={[styles.kpiValue, { color: "#6ee7b7" }]}>
              {isLoading || isError ? "—" : formatIls(totalSavings)}
            </Text>
          </View>
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
              borderColor: theme.border,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[styles.actionBtnText, { color: theme.text }]}>
            על מה חסכת?
          </Text>
          <ListChecks size={18} color={theme.text} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onReportUsage}
          style={[
            styles.actionBtn,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[styles.actionBtnText, { color: theme.text }]}>
            דיווח שימוש
          </Text>
          <ReceiptText size={18} color={theme.text} />
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
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
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
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  eyebrowText: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "700",
  },
  greetingText: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 4,
  },
  subGreetingText: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "right",
    marginTop: 2,
    marginBottom: 16,
  },
  balanceBox: {
    borderRadius: 18,
    padding: 16,
    alignItems: "flex-end",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  balanceLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  balanceValue: {
    color: "#34d399",
    fontSize: 32,
    fontWeight: "900",
  },
  balanceSub: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: "row-reverse",
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    padding: 10,
    alignItems: "flex-end",
  },
  kpiHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  kpiLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600",
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  actionButtonsRow: {
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 12,
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
