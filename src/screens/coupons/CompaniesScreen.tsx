import React, { useMemo, useState } from "react";
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Store } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { EmptyState } from "@/components/ui/EmptyState";
import { KuponiLoading } from "@/components/ui/KuponiLoading";
import { CompanyCardsSlider } from "@/components/dashboard/CompanyCardsSlider";
import { CompanySheet } from "@/components/dashboard/CompanySheet";
import { useCoupons } from "@/hooks/useCoupons";
import { useCouponUsageStats } from "@/hooks/useCouponUsage";
import { useAppTheme } from "@/contexts/ThemeContext";
import { companyCards } from "@/lib/companyCards";
import { companyKey } from "@/lib/companyName";
import { isSpendableCoupon } from "@/lib/couponTotals";

/**
 * Every shop in the wallet, and what is in each one.
 *
 * The home screen's "חברות" tile used to land on the coupons list, which
 * answered a different question — it is a list of coupons, and the company was
 * only ever a filter on it. The shop is the thing people actually stand in
 * front of, so it gets the grid and the sheet the dashboard opens: tap a
 * company, its coupons come up from the bottom with the codes on them.
 *
 * Same components and the same ordering as the dashboard, from
 * `companyCards`, so a shop is never near the top on one screen and buried on
 * another. `showAll` is the only difference: here the grid is the screen, so
 * nothing is collapsed behind "הצג הכול".
 */
export function CompaniesScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading, refetch, isRefetching } = useCoupons();
  const { data: usageStats } = useCouponUsageStats(coupons);
  const [sheetCompany, setSheetCompany] = useState<string | null>(null);

  // Spendable only, the same wallet the tile counted.
  const spendable = useMemo(() => coupons.filter(isSpendableCoupon), [coupons]);
  const cards = useMemo(() => companyCards(spendable, usageStats), [spendable, usageStats]);
  const sheetCoupons = useMemo(
    () =>
      sheetCompany
        ? spendable.filter((coupon) => companyKey(coupon.company) === companyKey(sheetCompany))
        : [],
    [spendable, sheetCompany]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <Header title="חברות" showBack onBack={() => router.back()} />
      {isLoading && coupons.length === 0 ? (
        <KuponiLoading title="אוסף את החנויות" subtitle="עובר על הקופונים בארנק" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        >
          {cards.length === 0 ? (
            <EmptyState
              icon={<Store size={32} color={theme.primary} />}
              title="אין עדיין חברות בארנק"
              subtitle="הקופון הראשון הוא גם החנות הראשונה."
              actionTitle="הוספת קופון"
              onAction={() => router.push("/scanner")}
            />
          ) : (
            <CompanyCardsSlider
              companyCards={cards}
              selectedCompany={sheetCompany}
              onSelectCompany={setSheetCompany}
              showAll
            />
          )}
        </ScrollView>
      )}

      <CompanySheet
        company={sheetCompany}
        coupons={sheetCoupons}
        onClose={() => setSheetCompany(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
});
