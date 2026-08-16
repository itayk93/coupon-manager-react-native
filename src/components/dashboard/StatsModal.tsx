import React from "react";
import { View, Text, StyleSheet, Image, FlatList } from "react-native";
import { Sparkles, TrendingUp, Tag, PieChart as PieIcon } from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { getCompanyLogo } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

type StatsModalProps = {
  visible: boolean;
  onClose: () => void;
  coupons: DecryptedCoupon[];
};

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

export function StatsModal({ visible, onClose, coupons }: StatsModalProps) {
  const { theme } = useAppTheme();

  const activeCoupons = coupons.filter(
    (c) => !c.is_for_sale && c.status !== "נוצל"
  );
  const totalValue = coupons.reduce((sum, c) => sum + (c.value || 0), 0);
  const totalCost = coupons.reduce((sum, c) => sum + (c.cost || 0), 0);
  const totalSavings = coupons.reduce(
    (sum, c) => sum + Math.max(0, (c.value || 0) - (c.cost || 0)),
    0
  );

  const savingsPct = totalValue > 0 ? (totalSavings / totalValue) * 100 : 0;
  const avgDiscount = coupons.length > 0 ? totalSavings / coupons.length : 0;

  // Breakdown by company
  const companySavingsMap = coupons.reduce<
    Record<string, { company: string; saved: number; count: number }>
  >((acc, c) => {
    const comp = c.company || "אחר";
    const saved = Math.max(0, (c.value || 0) - (c.cost || 0));
    if (!acc[comp]) {
      acc[comp] = { company: comp, saved: 0, count: 0 };
    }
    acc[comp].saved += saved;
    acc[comp].count += 1;
    return acc;
  }, {});

  const companySavings = Object.values(companySavingsMap)
    .filter((s) => s.saved > 0)
    .sort((a, b) => b.saved - a.saved);

  const topCompany = companySavings[0]?.company || "—";

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

        {companySavings.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            לא נמצאו חסכונות להצגה. הוסף קופונים כדי לראות את הפירוט!
          </Text>
        ) : (
          companySavings.map((item) => {
            const pct = totalSavings > 0 ? (item.saved / totalSavings) * 100 : 0;
            const logo = getCompanyLogo(item.company);

            return (
              <View
                key={item.company}
                style={[
                  styles.companyRow,
                  {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.companyInfo}>
                  <Text style={[styles.companySaved, { color: theme.primary }]}>
                    {formatIls(item.saved)}
                  </Text>
                  <Text style={[styles.companyCount, { color: theme.textMuted }]}>
                    ({item.count} קופונים)
                  </Text>
                </View>

                <View style={styles.companyNameGroup}>
                  <Text style={[styles.companyTitle, { color: theme.text }]}>
                    {item.company}
                  </Text>
                  <Image
                    source={{ uri: logo }}
                    style={styles.companyLogo}
                    resizeMode="contain"
                  />
                </View>
              </View>
            );
          })
        )}
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
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    marginVertical: 16,
  },
  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  companyNameGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  companyLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  companyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
  },
  companyInfo: {
    alignItems: "flex-start",
  },
  companySaved: {
    fontSize: 14,
    fontWeight: "800",
  },
  companyCount: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    marginTop: 2,
  },
});
