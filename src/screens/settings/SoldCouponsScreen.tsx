import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Header } from "@/components/ui/Header";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useCouponSales } from "@/hooks/useCouponSales";
import { formatIls } from "@/lib/formatIls";
import { formatDateHebrew } from "@/lib/formatDate";
import { fonts, radii, shadows } from "@/lib/theme";
import { MascotLoadingState } from "@/components/ui/MascotLoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShimmerLogo } from "@/components/coupons/ShimmerLogo";
import { getCompanyColor, getCompanyLogoSource, getContrastText } from "@/lib/companyLogos";

const statusLabel = { pending: "ממתינה", completed: "נמכר", declined: "נדחתה", cancelled: "בוטלה" } as const;

export function SoldCouponsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data: sales = [], isLoading } = useCouponSales();
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
    <Header title="קופונים שמכרתי" showBack onBack={() => router.back()} />
    {isLoading ? <MascotLoadingState title="טוען מכירות" subtitle="מרכזים את כל הקופונים שמכרת" /> : <ScrollView contentContainerStyle={styles.content}>
      {sales.length === 0 ? (
        <EmptyState
          title="עוד לא מכרת קופונים"
          subtitle="אחרי המכירה הראשונה יופיעו כאן המחיר, פרטי הקונה והרווח שלך."
        />
      ) : null}
      {sales.map((sale) => {
        const profit = sale.sale_price - sale.coupon_cost_snapshot;
        const brandColor = getCompanyColor(sale.company_snapshot);
        const brandTextColor = getContrastText(brandColor);
        const logoSource = getCompanyLogoSource(sale.company_snapshot);
        const statusBackground = brandTextColor === "#ffffff"
          ? "rgba(255,255,255,0.22)"
          : "rgba(0,0,0,0.12)";

        return (
          <View key={sale.id} style={[styles.card, shadows.card, { backgroundColor: theme.card }]}>
            <View style={[styles.brandHeader, { backgroundColor: brandColor }]}>
              <ShimmerLogo
                source={logoSource}
                size={56}
                style={[styles.logoFrame, { backgroundColor: theme.card }]}
                imageStyle={styles.logoImage}
              />
              <Text numberOfLines={1} style={[styles.company, { color: brandTextColor }]}>
                {sale.company_snapshot || "ללא חברה"}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: statusBackground }]}>
                <Text style={[styles.status, { color: brandTextColor }]}>{statusLabel[sale.status]}</Text>
              </View>
            </View>

            <View style={styles.body}>
              <Text style={[styles.line, { color: theme.text }]}>מחיר מכירה: {formatIls(sale.sale_price)}</Text>
              <Text style={[styles.profit, { color: profit >= 0 ? theme.success : theme.danger }]}>רווח: {formatIls(profit)}</Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>שווי {formatIls(sale.coupon_value_snapshot)} · עלות {formatIls(sale.coupon_cost_snapshot)}</Text>
              {sale.buyer_name || sale.buyer_phone ? <Text style={[styles.meta, { color: theme.textMuted }]}>נמכר ל{[sale.buyer_name, sale.buyer_phone].filter(Boolean).join(" · ")}</Text> : null}
              {sale.buyer_email ? <Text style={[styles.meta, { color: theme.textMuted }]}>{sale.buyer_email}</Text> : null}
              <Text style={[styles.meta, { color: theme.textMuted }]}>{formatDateHebrew(sale.sold_at || sale.created_at)} · {sale.sale_type === "transfer" ? "העברה באפליקציה" : "סימון ידני"}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 20 },
  card: {
    borderRadius: radii.sheet,
    overflow: "hidden",
  },
  brandHeader: {
    height: 76,
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  logoFrame: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.lifted,
  },
  logoImage: {
    width: "74%",
    height: "74%",
  },
  company: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  status: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: "800",
  },
  body: {
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 6,
  },
  line: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    textAlign: "right",
  },
  profit: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "right",
  },
});
