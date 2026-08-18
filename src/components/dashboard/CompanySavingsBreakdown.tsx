import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";
import { Modal } from "@/components/ui/Modal";

type CompanySavingsBreakdownProps = {
  coupons: DecryptedCoupon[];
};

type CompanySavings = {
  company: string;
  saved: number;
  value: number;
  count: number;
  avgPct: number;
  items: DecryptedCoupon[];
};

const DEFAULT_VISIBLE_COUNT = 5;

function couponTime(c: DecryptedCoupon) {
  const t = c.date_added ? new Date(c.date_added).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function formatDate(value?: string | null) {
  if (!value) return "ללא תאריך";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "ללא תאריך";
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * The "על מה חסכת?" company drill-down. The collapsed row shows a single
 * headline number (total saved), keeping the list scannable; the average
 * discount, coupon count and per-coupon breakdown move to a bottom sheet.
 */
export function CompanySavingsBreakdown({ coupons }: CompanySavingsBreakdownProps) {
  const { theme } = useAppTheme();
  const [showAll, setShowAll] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanySavings | null>(null);

  const companySavings = useMemo<CompanySavings[]>(() => {
    const map = coupons.reduce<Record<string, Omit<CompanySavings, "avgPct">>>(
      (acc, c) => {
        const company = c.company || "אחר";
        const saved = Math.max(0, (c.value || 0) - (c.cost || 0));
        if (!acc[company]) {
          acc[company] = { company, saved: 0, value: 0, count: 0, items: [] };
        }
        acc[company].saved += saved;
        acc[company].value += c.value || 0;
        acc[company].count += 1;
        acc[company].items.push(c);
        return acc;
      },
      {}
    );

    return Object.values(map)
      .filter((s) => s.saved > 0)
      .sort((a, b) => b.saved - a.saved)
      .map((s) => ({
        ...s,
        avgPct: s.value > 0 ? (s.saved / s.value) * 100 : 0,
        items: [...s.items].sort((a, b) => couponTime(b) - couponTime(a)),
      }));
  }, [coupons]);

  if (companySavings.length === 0) {
    return (
      <Text style={[styles.emptyText, { color: theme.textMuted }]}>
        לא נמצאו חסכונות להצגה. הוסף קופונים כדי לראות את הפירוט!
      </Text>
    );
  }

  const visibleCompanies = showAll
    ? companySavings
    : companySavings.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMore = companySavings.length > DEFAULT_VISIBLE_COUNT;

  return (
    <View>
      {visibleCompanies.map((item) => (
        <Pressable
          key={item.company}
          accessibilityRole="button"
          accessibilityLabel={`${item.company}: ${formatIls(item.saved)}`}
          onPress={() => setSelectedCompany(item)}
          style={({ pressed }) => [
            styles.companyRow,
            {
              backgroundColor: theme.surfaceAlt,
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View style={styles.companySavedWrap}>
            <Text style={[styles.companySaved, { color: theme.primary }]}>
              {formatIls(item.saved)}
            </Text>
          </View>

          <View style={styles.companyNameGroup}>
            <ChevronLeft size={16} color={theme.textMuted} />
            <Text style={[styles.companyTitle, { color: theme.text }]}>
              {item.company}
            </Text>
            <Image source={getCompanyLogoSource(item.company)} style={styles.companyLogo} resizeMode="contain" />
          </View>
        </Pressable>
      ))}

      {hasMore && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowAll((prev) => !prev)}
          style={({ pressed }) => [
            styles.toggleBtn,
            { backgroundColor: theme.surfaceAlt, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.toggleText, { color: theme.primary }]}>
            {showAll ? "הצג פחות" : `הצג את כל ${companySavings.length} החברות`}
          </Text>
        </Pressable>
      )}

      <Modal
        visible={selectedCompany !== null}
        onClose={() => setSelectedCompany(null)}
        title={selectedCompany?.company}
        subtitle={
          selectedCompany
            ? `${selectedCompany.count} קופונים · הנחה ממוצעת ${selectedCompany.avgPct.toFixed(1)}%`
            : undefined
        }
      >
        {selectedCompany && (
          <View style={styles.sheetBody}>
            <View style={styles.summaryRow}>
              <SummaryStat label="סה״כ נחסך" value={formatIls(selectedCompany.saved)} color={theme.primary} />
              <SummaryStat label="שווי כולל" value={formatIls(selectedCompany.value)} color={theme.text} />
              <SummaryStat
                label="הנחה ממוצעת"
                value={`${selectedCompany.avgPct.toFixed(1)}%`}
                color={theme.accent}
              />
            </View>

            {selectedCompany.items.map((c) => {
              const value = c.value || 0;
              const cost = c.cost || 0;
              const saved = Math.max(0, value - cost);
              const pct = value > 0 ? (saved / value) * 100 : 0;

              return (
                <View
                  key={c.id}
                  style={[
                    styles.couponCard,
                    { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.couponHeader}>
                    <Text style={[styles.couponDate, { color: theme.text }]}>
                      {formatDate(c.date_added)}
                    </Text>
                    <Text
                      style={[
                        styles.couponPct,
                        { color: saved > 0 ? theme.primary : theme.textMuted },
                      ]}
                    >
                      {pct.toFixed(1)}% הנחה
                    </Text>
                  </View>

                  <View style={styles.couponMetrics}>
                    <Metric label="עלה" value={formatIls(cost)} color={theme.text} muted={theme.textMuted} />
                    <Metric label="שווה" value={formatIls(value)} color={theme.text} muted={theme.textMuted} />
                    <Metric label="נחסך" value={formatIls(saved)} color={theme.primary} muted={theme.textMuted} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Modal>
    </View>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: string; color: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.summaryStat, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
      <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.summaryValue, { color }]}>
        {value}
      </Text>
    </View>
  );
}

function Metric({
  label,
  value,
  color,
  muted,
}: {
  label: string;
  value: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: muted }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.metricValue, { color }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  companySavedWrap: {
    alignItems: "flex-start",
  },
  companySaved: {
    fontSize: 14,
    fontWeight: "800",
  },
  companyNameGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
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
    flexShrink: 1,
  },
  toggleBtn: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    marginTop: 2,
  },
  toggleText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "700",
  },
  sheetBody: {
    paddingBottom: 4,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  summaryStat: {
    flex: 1,
    alignItems: "flex-end",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 3,
  },
  summaryValue: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: "900",
  },
  couponCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  couponHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  couponDate: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: "700",
  },
  couponPct: {
    fontSize: 12,
    fontWeight: "800",
  },
  couponMetrics: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 8,
  },
  metric: {
    flex: 1,
    alignItems: "flex-end",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "800",
  },
});
