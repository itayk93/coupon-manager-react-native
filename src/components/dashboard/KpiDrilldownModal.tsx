import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { CalendarDays, ChevronDown } from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { couponRemainingValue } from "@/lib/couponTotals";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";

export type KpiMetric = "remaining" | "savings" | "used" | "value";

export type KpiConfig = {
  key: KpiMetric;
  title: string;
};

function metricValue(coupon: DecryptedCoupon, metric: KpiMetric): number {
  switch (metric) {
    case "remaining":
      return Math.max(0, couponRemainingValue(coupon));
    case "savings":
      return Math.max(0, (coupon.value || 0) - (coupon.cost || 0));
    case "used":
      return coupon.used_value || 0;
    case "value":
      return coupon.value || 0;
  }
}

type MonthBucket = {
  key: string;
  label: string;
  value: number;
};

type YearBucket = {
  key: string;
  label: string;
  value: number;
  months: MonthBucket[];
};

const MISSING_DATE_KEY = "__missing__";

function buildYearBuckets(coupons: DecryptedCoupon[], metric: KpiMetric): YearBucket[] {
  const yearMap = new Map<string, { yearKey: string; label: string; total: number; months: Map<string, MonthBucket> }>();

  const addCoupon = (bucketKey: string, label: string, coupon: DecryptedCoupon, monthKey: string, monthLabel: string) => {
    const value = metricValue(coupon, metric);
    if (value <= 0) return;

    let bucket = yearMap.get(bucketKey);
    if (!bucket) {
      bucket = { yearKey: bucketKey, label, total: 0, months: new Map() };
      yearMap.set(bucketKey, bucket);
    }
    bucket.total += value;

    let month = bucket.months.get(monthKey);
    if (!month) {
      month = { key: monthKey, label: monthLabel, value: 0 };
      bucket.months.set(monthKey, month);
    }
    month.value += value;
  };

  coupons.forEach((coupon) => {
    const date = coupon.date_added ? new Date(coupon.date_added) : null;
    if (!date || Number.isNaN(date.getTime())) {
      addCoupon(MISSING_DATE_KEY, "ללא תאריך", coupon, `${MISSING_DATE_KEY}-0`, "ללא תאריך");
      return;
    }

    const year = date.getFullYear();
    const monthKey = `${year}-${date.getMonth()}`;
    const yearKey = `${year}`;
    const monthLabel = date.toLocaleDateString("he-IL", { month: "long" });
    addCoupon(yearKey, `${year}`, coupon, monthKey, monthLabel);
  });

  return Array.from(yearMap.values())
    .map((bucket) => ({
      key: bucket.yearKey,
      label: bucket.label,
      value: bucket.total,
      months: Array.from(bucket.months.values()).sort((a, b) => b.key.localeCompare(a.key)),
    }))
    .sort((a, b) => {
      if (a.key === MISSING_DATE_KEY) return 1;
      if (b.key === MISSING_DATE_KEY) return -1;
      return Number(b.key) - Number(a.key);
    });
}

type KpiDrilldownModalProps = {
  visible: boolean;
  onClose: () => void;
  config: KpiConfig | null;
  coupons: DecryptedCoupon[];
};

export function KpiDrilldownModal({ visible, onClose, config, coupons }: KpiDrilldownModalProps) {
  const { theme } = useAppTheme();
  const [expandedYear, setExpandedYear] = useState<string | null>(null);

  const years = useMemo(
    () => (config ? buildYearBuckets(coupons, config.key) : []),
    [config, coupons]
  );

  const total = years.reduce((sum, year) => sum + year.value, 0);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={config?.title || "פירוט לפי שנים וחודשים"}
      subtitle="התפלגות לפי תאריך הוספת הקופון"
    >
      <View style={styles.container}>
        <View
          style={[
            styles.totalBox,
            { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.totalLabel, { color: theme.textMuted }]}>סה״כ</Text>
          <Text style={[styles.totalValue, { color: theme.primary }]}>{formatIls(total)}</Text>
        </View>

        {years.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            אין נתונים להצגה עבור מדד זה.
          </Text>
        ) : (
          years.map((year) => {
            const isOpen = expandedYear === year.key;
            return (
              <View key={year.key} style={styles.yearBlock}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  onPress={() => setExpandedYear(isOpen ? null : year.key)}
                  style={({ pressed }) => [
                    styles.yearRow,
                    {
                      backgroundColor: theme.surfaceAlt,
                      borderColor: isOpen ? theme.primary : theme.border,
                      opacity: pressed ? 0.7 : 1,
                      borderBottomLeftRadius: isOpen ? 0 : 14,
                      borderBottomRightRadius: isOpen ? 0 : 14,
                    },
                  ]}
                >
                  <View style={styles.yearInfo}>
                    <Text style={[styles.yearValue, { color: theme.primary }]}>
                      {formatIls(year.value)}
                    </Text>
                    <Text style={[styles.yearCount, { color: theme.textMuted }]}>
                      {year.months.length} חודשים
                    </Text>
                  </View>

                  <View style={styles.yearNameGroup}>
                    <ChevronDown
                      size={16}
                      color={theme.textMuted}
                      style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
                    />
                    <Text style={[styles.yearTitle, { color: theme.text }]}>
                      {year.label}
                    </Text>
                    <CalendarDays size={16} color={theme.primary} />
                  </View>
                </Pressable>

                {isOpen && (
                  <View
                    style={[
                      styles.monthsList,
                      { backgroundColor: theme.surface, borderColor: theme.primary },
                    ]}
                  >
                    {year.months.map((month) => (
                      <View
                        key={month.key}
                        style={[styles.monthRow, { borderBottomColor: theme.border }]}
                      >
                        <Text style={[styles.monthValue, { color: theme.text }]}>
                          {formatIls(month.value)}
                        </Text>
                        <Text style={[styles.monthLabel, { color: theme.textMuted }]}>
                          {month.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
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
  totalBox: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 16,
    alignItems: "flex-end",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  totalValue: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "900",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    marginVertical: 16,
  },
  yearBlock: {
    marginBottom: 8,
  },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  yearInfo: {
    alignItems: "flex-start",
  },
  yearValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  yearCount: {
    fontSize: 11,
    marginTop: 2,
  },
  yearNameGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  yearTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    fontWeight: "700",
  },
  monthsList: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingHorizontal: 12,
  },
  monthRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthValue: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: "800",
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
});
