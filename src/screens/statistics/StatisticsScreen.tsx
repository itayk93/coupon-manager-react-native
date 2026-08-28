import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  TrendingUp,
  Sparkles,
  CheckCircle2,
  WalletCards,
  PieChart as PieIcon,
} from "lucide-react-native";
import { useCoupons } from "@/hooks/useCoupons";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";
import {
  KpiDrilldownModal,
  type KpiConfig,
  type KpiMonthSelection,
} from "@/components/dashboard/KpiDrilldownModal";
import { CompanySavingsBreakdown } from "@/components/dashboard/CompanySavingsBreakdown";
import { StatusDrilldownModal } from "@/components/dashboard/StatusDrilldownModal";
import type { CouponStatusFilter } from "@/components/dashboard/StatusDrilldownModal";

export function StatisticsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data: coupons = [] } = useCoupons();
  const [activeKpi, setActiveKpi] = useState<KpiConfig | null>(null);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CouponStatusFilter | null>(null);
  const [expandedYear, setExpandedYear] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<KpiMonthSelection | null>(null);

  const handleOpenCoupon = (couponId: number) => {
    router.push(`/coupons/${couponId}`);
  };

  const totalValue = useMemo(
    () => coupons.reduce((sum, c) => sum + (c.value || 0), 0),
    [coupons]
  );
  const usedValue = useMemo(
    () => coupons.reduce((sum, c) => sum + (c.used_value || 0), 0),
    [coupons]
  );
  const totalSavings = useMemo(
    () =>
      coupons.reduce(
        (sum, c) => sum + Math.max(0, (c.value || 0) - (c.cost || 0)),
        0
      ),
    [coupons]
  );
  const remainingValue = Math.max(0, totalValue - usedValue);

  const statusStats = useMemo(() => {
    let active = 0;
    let fullyUsed = 0;
    let expired = 0;
    const now = Date.now();

    coupons.forEach((c) => {
      const rem = (c.value || 0) - (c.used_value || 0);
      if (c.status === "נוצל" || rem <= 0) {
        fullyUsed++;
      } else if (c.expiration && new Date(c.expiration).getTime() < now) {
        expired++;
      } else {
        active++;
      }
    });

    return { active, fullyUsed, expired };
  }, [coupons]);

  // "חיסכון חודשי" — the last six months of coupon usage, per the design.
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        shortLabel: d.toLocaleDateString("he-IL", { month: "short" }),
        fullLabel: d.toLocaleDateString("he-IL", { month: "long", year: "numeric" }),
        value: 0,
      };
    });
    coupons.forEach((c) => {
      if (!c.date_added) return;
      const d = new Date(c.date_added);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = months.find((m) => m.key === key);
      if (bucket) bucket.value += c.used_value || 0;
    });
    const max = Math.max(1, ...months.map((m) => m.value));
    return months.map((m) => ({ ...m, pct: Math.round((m.value / max) * 100) }));
  }, [coupons]);

  const kpiConfigs: KpiConfig[] = [
    { key: "remaining", title: "יתרה זמינה" },
    { key: "savings", title: "חיסכון מצטבר" },
    { key: "used", title: "סך הכל נוצל" },
    { key: "value", title: "סך שווי קופונים" },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.pageTitle, { color: theme.text }]}>על מה חסכת</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Top 4-Grid */}
        <View style={styles.kpiGrid}>
          {[
            { config: kpiConfigs[0], label: "יתרה זמינה", value: remainingValue, color: theme.text, icon: <WalletCards size={16} color={theme.primary} /> },
            { config: kpiConfigs[1], label: "חיסכון מצטבר", value: totalSavings, color: theme.success, icon: <Sparkles size={16} color={theme.success} /> },
            { config: kpiConfigs[2], label: "סך הכל נוצל", value: usedValue, color: theme.text, icon: <CheckCircle2 size={16} color={theme.primary} /> },
            { config: kpiConfigs[3], label: "סך שווי קופונים", value: totalValue, color: theme.text, icon: <TrendingUp size={16} color={theme.warning} /> },
          ].map((kpi) => (
            <TouchableOpacity
              key={kpi.config.key}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={kpi.label}
              onPress={() => setActiveKpi(kpi.config)}
              style={[
                styles.kpiCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.kpiHeader}>
                <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>{kpi.label}</Text>
                {kpi.icon}
              </View>
              <Text
                style={[styles.kpiValue, { color: kpi.color }]}
                maxFontSizeMultiplier={1.3}
              >
                {formatIls(kpi.value)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Monthly savings */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>חיסכון חודשי</Text>
          </View>

          <View style={styles.barsRow}>
            {monthlyTrend.map((m) => {
              const isActive = activeMonth === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.fullLabel}: ${formatIls(m.value)}`}
                  onPress={() => setActiveMonth(isActive ? null : m.key)}
                  style={styles.barCol}
                >
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(m.pct, 2)}%`,
                          backgroundColor: isActive ? theme.primaryDark : theme.primary,
                          opacity: activeMonth && !isActive ? 0.55 : 1,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barLabel, { color: theme.textSubtle }]}>{m.shortLabel}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* The readout sits under the bars, where the tapped bar is: above
              them it pushed the whole chart down on every tap, and read as a
              header rather than as the answer to the tap. */}
          {activeMonth ? (
            <Text
              style={[styles.monthReadout, { color: theme.text }]}
              maxFontSizeMultiplier={1.3}
            >
              {`בחודש ${monthlyTrend.find((m) => m.key === activeMonth)?.fullLabel} חסכת `}
              <Text style={{ color: theme.primary }}>
                {formatIls(monthlyTrend.find((m) => m.key === activeMonth)?.value || 0)}
              </Text>
            </Text>
          ) : (
            <Text style={[styles.monthReadout, { color: theme.textSubtle }]}>
              נגעו בעמודה כדי לראות כמה חסכתם באותו חודש
            </Text>
          )}
        </View>

        {/* Status Distribution */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              התפלגות סטטוס קופונים
            </Text>
            <PieIcon size={18} color={theme.primary} />
          </View>

          <View style={styles.statusDistributionRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="פעילים"
              onPress={() => setStatusFilter("active")}
              style={styles.statusCol}
            >
              <Text
                style={[styles.statusNum, { color: theme.primary }]}
                maxFontSizeMultiplier={1.3}
              >
                {statusStats.active}
              </Text>
              <Text style={[styles.statusLabel, { color: theme.textMuted }]}>פעילים</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="נוצלו במלואם"
              onPress={() => setStatusFilter("used")}
              style={styles.statusCol}
            >
              <Text
                style={[styles.statusNum, { color: theme.primary }]}
                maxFontSizeMultiplier={1.3}
              >
                {statusStats.fullyUsed}
              </Text>
              <Text style={[styles.statusLabel, { color: theme.textMuted }]}>נוצלו במלואם</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="פגי תוקף"
              onPress={() => setStatusFilter("expired")}
              style={styles.statusCol}
            >
              <Text
                style={[styles.statusNum, { color: theme.danger }]}
                maxFontSizeMultiplier={1.3}
              >
                {statusStats.expired}
              </Text>
              <Text style={[styles.statusLabel, { color: theme.textMuted }]}>פגי תוקף</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Top Companies Breakdown */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              החברות המובילות בארנק
            </Text>
          </View>
          <CompanySavingsBreakdown coupons={coupons} />
        </View>
      </ScrollView>

      <KpiDrilldownModal
        visible={activeKpi !== null}
        onClose={() => setActiveKpi(null)}
        config={activeKpi}
        coupons={coupons}
        onOpenCoupon={handleOpenCoupon}
        expandedYear={expandedYear}
        onExpandedYearChange={setExpandedYear}
        selectedMonth={selectedMonth}
        onSelectedMonthChange={setSelectedMonth}
      />

      <StatusDrilldownModal
        visible={statusFilter !== null}
        onClose={() => setStatusFilter(null)}
        filter={statusFilter}
        coupons={coupons}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  barsRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    gap: 10,
    height: 150,
    marginTop: 16,
  },
  barCol: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
  },
  barTrack: {
    flex: 1,
    width: "100%",
    maxWidth: 34,
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  barLabel: {
    fontSize: 11,
  },
  monthReadout: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    writingDirection: "rtl",
    marginTop: 14,
  },
  titleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 12,
  },
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "right",
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 40,
  },
  kpiGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    width: "48%",
    padding: 16,
    borderRadius: radii.card,
    borderWidth: 1,
    alignItems: "flex-end",
    ...shadows.card,
  },
  kpiHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  kpiLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    fontWeight: "600",
  },
  kpiValue: {
    fontFamily: fonts.display,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 6,
  },
  sectionCard: {
    borderRadius: radii.cardLg,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
    ...shadows.card,
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
  },
  statusDistributionRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    paddingVertical: 8,
  },
  statusCol: {
    alignItems: "center",
  },
  statusNum: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 2,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
});
