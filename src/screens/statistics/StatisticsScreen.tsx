import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  BarChart3,
  TrendingUp,
  Sparkles,
  Download,
  CheckCircle2,
  Clock,
  WalletCards,
  PieChart as PieIcon,
} from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCoupons } from "@/hooks/useCoupons";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";
import { notify } from "@/lib/notify";

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

export function StatisticsScreen() {
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading } = useCoupons();

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

  const companyStats = useMemo(() => {
    const map: Record<
      string,
      { company: string; totalValue: number; usedValue: number; count: number }
    > = {};

    coupons.forEach((c) => {
      const comp = c.company || "ללא חברה";
      if (!map[comp]) {
        map[comp] = { company: comp, totalValue: 0, usedValue: 0, count: 0 };
      }
      map[comp].totalValue += c.value || 0;
      map[comp].usedValue += c.used_value || 0;
      map[comp].count += 1;
    });

    return Object.values(map)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);
  }, [coupons]);

  const handleExportCSV = async () => {
    if (coupons.length === 0) {
      notify.warning("אין נתונים לייצוא");
      return;
    }

    try {
      const headers = "חברה,קוד,שווי,נוצל,יתרה,עלות,תאריך תפוגה,סטטוס\n";
      const rows = coupons
        .map((c) => {
          const rem = Math.max(0, (c.value || 0) - (c.used_value || 0));
          return `"${c.company}","${c.code}",${c.value},${c.used_value},${rem},${c.cost || 0},"${c.expiration || ""}",${c.status || "פעיל"}`;
        })
        .join("\n");

      const csvContent = "\uFEFF" + headers + rows; // UTF-8 BOM for Hebrew Excel
      // expo-file-system dropped the `*AsStringAsync` helpers in SDK 54; the
      // File API writes strings as UTF-8, which the BOM above relies on.
      const file = new File(Paths.document, `coupons_report_${Date.now()}.csv`);
      file.create({ overwrite: true });
      file.write(csvContent);
      const fileUri = file.uri;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "ייצוא דוח קופונים ל-CSV",
        });
      } else {
        notify.success("הקובץ נוצר בהצלחה!", fileUri);
      }
    } catch (e: any) {
      notify.error("שגיאה בייצוא הדוח", e.message);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header
        title="סטטיסטיקות ודוחות"
        rightAction={
          <TouchableOpacity
            onPress={handleExportCSV}
            style={[styles.exportBtn, { backgroundColor: theme.surfaceAlt }]}
          >
            <Download size={16} color={theme.primary} />
            <Text style={[styles.exportBtnText, { color: theme.primary }]}>ייצוא CSV</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Top 4-Grid */}
        <View style={styles.kpiGrid}>
          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>יתרה זמינה</Text>
              <WalletCards size={16} color={theme.primary} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.text }]}>
              {formatIls(remainingValue)}
            </Text>
          </View>

          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>חיסכון מצטבר</Text>
              <Sparkles size={16} color={theme.success} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.success }]}>
              {formatIls(totalSavings)}
            </Text>
          </View>

          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>סך הכל נוצל</Text>
              <CheckCircle2 size={16} color={theme.primary} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.text }]}>
              {formatIls(usedValue)}
            </Text>
          </View>

          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>סך שווי קופונים</Text>
              <TrendingUp size={16} color={theme.warning} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.text }]}>
              {formatIls(totalValue)}
            </Text>
          </View>
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
            <View style={styles.statusCol}>
              <Text style={[styles.statusNum, { color: theme.primary }]}>
                {statusStats.active}
              </Text>
              <Text style={[styles.statusLabel, { color: theme.textMuted }]}>פעילים</Text>
            </View>

            <View style={styles.statusCol}>
              <Text style={[styles.statusNum, { color: theme.primary }]}>
                {statusStats.fullyUsed}
              </Text>
              <Text style={[styles.statusLabel, { color: theme.textMuted }]}>נוצלו במלואם</Text>
            </View>

            <View style={styles.statusCol}>
              <Text style={[styles.statusNum, { color: theme.danger }]}>
                {statusStats.expired}
              </Text>
              <Text style={[styles.statusLabel, { color: theme.textMuted }]}>פגי תוקף</Text>
            </View>
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
              10 החברות המובילות בארנק
            </Text>
            <BarChart3 size={18} color={theme.primary} />
          </View>

          {companyStats.length > 0 ? (
            companyStats.map((item, idx) => {
              const rem = Math.max(0, item.totalValue - item.usedValue);
              const pct = totalValue > 0 ? (item.totalValue / totalValue) * 100 : 0;
              const logo = getCompanyLogoSource(item.company);

              return (
                <View
                  key={item.company}
                  style={[
                    styles.companyStatRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <View style={styles.companyValuesCol}>
                    <Text style={[styles.companyRemVal, { color: theme.primary }]}>
                      {formatIls(rem)}
                    </Text>
                    <Text style={[styles.companyTotalVal, { color: theme.textMuted }]}>
                      מתוך {formatIls(item.totalValue)}
                    </Text>
                  </View>

                  <View style={styles.companyNameGroup}>
                    <View style={styles.companyTitleBox}>
                      <Text style={[styles.companyStatName, { color: theme.text }]}>
                        {item.company}
                      </Text>
                      <Text style={[styles.companyStatCount, { color: theme.textMuted }]}>
                        {item.count} קופונים ({pct.toFixed(0)}%)
                      </Text>
                    </View>
                    <Image source={logo} style={styles.companyStatLogo} resizeMode="contain" />
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={{ color: theme.textMuted, textAlign: "center", paddingVertical: 14 }}>
              אין עדיין נתונים להצגה
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  exportBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: "700",
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
  companyStatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  companyNameGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    flex: 1,
    justifyContent: "flex-start",
  },
  companyStatLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  companyTitleBox: {
    alignItems: "flex-end",
  },
  companyStatName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
  },
  companyStatCount: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    marginTop: 2,
  },
  companyValuesCol: {
    alignItems: "flex-start",
  },
  companyRemVal: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: "800",
  },
  companyTotalVal: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    marginTop: 2,
  },
});
