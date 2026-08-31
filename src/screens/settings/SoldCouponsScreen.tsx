import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Header } from "@/components/ui/Header";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useCouponSales } from "@/hooks/useCouponSales";
import { formatIls } from "@/lib/formatIls";
import { formatDateHebrew } from "@/lib/formatDate";
import { fonts, radii } from "@/lib/theme";
import { MascotLoadingState } from "@/components/ui/MascotLoadingState";
import { EmptyState } from "@/components/ui/EmptyState";

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
        return <View key={sale.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.top}><Text style={[styles.status, { color: sale.status === "completed" ? theme.success : theme.textMuted }]}>{statusLabel[sale.status]}</Text><Text style={[styles.company, { color: theme.text }]}>{sale.company_snapshot}</Text></View>
          <Text style={[styles.line, { color: theme.text }]}>מחיר מכירה: {formatIls(sale.sale_price)}</Text>
          <Text style={[styles.line, { color: profit >= 0 ? theme.success : theme.danger }]}>רווח: {formatIls(profit)}</Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>שווי {formatIls(sale.coupon_value_snapshot)} · עלות {formatIls(sale.coupon_cost_snapshot)}</Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>נמכר ל{sale.buyer_first_name} {sale.buyer_last_name} · {sale.buyer_phone}</Text>
          {sale.buyer_email ? <Text style={[styles.meta, { color: theme.textMuted }]}>{sale.buyer_email}</Text> : null}
          <Text style={[styles.meta, { color: theme.textMuted }]}>{formatDateHebrew(sale.sold_at || sale.created_at)} · {sale.sale_type === "transfer" ? "העברה באפליקציה" : "סימון ידני"}</Text>
        </View>;
      })}
    </ScrollView>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe:{flex:1},content:{padding:16,paddingBottom:40,gap:10},card:{borderWidth:1,borderRadius:radii.xl,padding:16,gap:6},top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},company:{fontFamily:fonts.display,fontSize:18,fontWeight:"800"},status:{fontFamily:fonts.bodyBold,fontSize:12},line:{fontFamily:fonts.bodyBold,fontSize:15,textAlign:"right"},meta:{fontFamily:fonts.body,fontSize:13,textAlign:"right"} });
