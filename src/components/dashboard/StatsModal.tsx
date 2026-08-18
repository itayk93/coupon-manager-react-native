import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  Sparkles,
  TrendingUp,
  Tag,
  PieChart as PieIcon,
} from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";
import { CompanySavingsBreakdown } from "@/components/dashboard/CompanySavingsBreakdown";

type StatsModalProps = {
  visible: boolean;
  onClose: () => void;
  coupons: DecryptedCoupon[];
};

export function StatsModal({ visible, onClose, coupons }: StatsModalProps) {
  const { theme } = useAppTheme();

  const totalValue = coupons.reduce((sum, c) => sum + (c.value || 0), 0);
  const totalSavings = coupons.reduce(
    (sum, c) => sum + Math.max(0, (c.value || 0) - (c.cost || 0)),
    0
  );

  const savingsPct = totalValue > 0 ? (totalSavings / totalValue) * 100 : 0;
  const avgDiscount = coupons.length > 0 ? totalSavings / coupons.length : 0;

  const topCompany = [...coupons]
    .filter((c) => Math.max(0, (c.value || 0) - (c.cost || 0)) > 0)
    .sort(
      (a, b) =>
        Math.max(0, (b.value || 0) - (b.cost || 0)) -
        Math.max(0, (a.value || 0) - (a.cost || 0))
    )[0]?.company || "—";

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="על מה חסכת?"
      subtitle="סיכום וניתוח החסכונות שלך מכל הקופונים"
    >
      <View style={styles.container}>
        {/* 2x2 Bento KPI Grid (fixed for mobile!) */}
        <View style={styles.grid}>
          <View
            style={[
              styles.kpiBox,
              {
                backgroundColor: theme.surfaceAlt,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>
                סה״כ נחסך
              </Text>
              <Sparkles size={16} color={theme.primary} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.primary }]}>
              {formatIls(totalSavings)}
            </Text>
          </View>

          <View
            style={[
              styles.kpiBox,
              {
                backgroundColor: theme.surfaceAlt,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>
                אחוז חיסכון ממוצע
              </Text>
              <TrendingUp size={16} color={theme.primary} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.primary }]}>
              {savingsPct.toFixed(1)}%
            </Text>
          </View>

          <View
            style={[
              styles.kpiBox,
              {
                backgroundColor: theme.surfaceAlt,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>
                חיסכון ממוצע לקופון
              </Text>
              <Tag size={16} color={theme.accent} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.accent }]}>
              {formatIls(avgDiscount)}
            </Text>
          </View>

          <View
            style={[
              styles.kpiBox,
              {
                backgroundColor: theme.surfaceAlt,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>
                החיסכון הגדול ביותר
              </Text>
              <PieIcon size={16} color={theme.warning} />
            </View>
            <Text
              numberOfLines={1}
              style={[styles.kpiValue, { color: theme.warning, fontSize: 16 }]}
            >
              {topCompany}
            </Text>
          </View>
        </View>

        {/* Company Savings Breakdown */}
        <Text style={[styles.breakdownTitle, { color: theme.text }]}>
          פירוט חסכונות לפי חברה
        </Text>
        <CompanySavingsBreakdown coupons={coupons} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  kpiBox: {
    width: "48%",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-end",
  },
  kpiHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  kpiValue: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900",
  },
  breakdownTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 12,
  },
});
