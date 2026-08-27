import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Tag, Sparkles, ChevronLeft } from "lucide-react-native";
import { WalletHeroCard } from "@/components/dashboard/WalletHeroCard";
import { ExpiringCouponsBanner } from "@/components/dashboard/ExpiringCouponsBanner";
import { OnboardingBanner, useOnboardingPending } from "@/components/layout/OnboardingBanner";
import { PushNudgeBanner } from "@/components/layout/PushNudgeBanner";
import { CompanyCardsSlider } from "@/components/dashboard/CompanyCardsSlider";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";
import { CompanySheet } from "@/components/dashboard/CompanySheet";
import { CouponCard } from "@/components/coupons/CouponCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCoupons, DecryptedCoupon } from "@/hooks/useCoupons";
import { useCouponUsageStats } from "@/hooks/useCouponUsage";
import { useCouponTagsMap } from "@/hooks/useTags";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
import { isSpendableCoupon } from "@/lib/couponTotals";

export function DashboardScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading, isError, refetch, isRefetching } = useCoupons();
  const { data: usageStats } = useCouponUsageStats(coupons);
  const { data: tagsMap = {} } = useCouponTagsMap();
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  // Set when a coupon card is held: the usage modal opens on that coupon.
  const [usageCoupon, setUsageCoupon] = useState<DecryptedCoupon | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [sheetCompany, setSheetCompany] = useState<string | null>(null);

  const visibleCoupons = useMemo(() => {
    const spendable = coupons.filter(isSpendableCoupon);
    const couponUsage = usageStats?.usageCountByCoupon || {};
    return spendable.sort((a, b) => {
      const latestA = usageStats?.latestUsageByCoupon?.[a.id] || 0;
      const latestB = usageStats?.latestUsageByCoupon?.[b.id] || 0;
      if (latestA !== latestB) return latestB - latestA;

      const usageA = couponUsage[a.id] || 0;
      const usageB = couponUsage[b.id] || 0;
      if (usageA !== usageB) return usageB - usageA;

      const dateA = a.date_added ? new Date(a.date_added).getTime() : 0;
      const dateB = b.date_added ? new Date(b.date_added).getTime() : 0;
      return dateB - dateA;
    });
  }, [coupons, usageStats]);

  const companyCards = useMemo(() => {
    const map = visibleCoupons.reduce<Record<string, { company: string; count: number }>>(
      (acc, coupon) => {
        const company = coupon.company || "ללא חברה";
        acc[company] = acc[company] || { company, count: 0 };
        acc[company].count += 1;
        return acc;
      },
      {}
    );

    const companyUsage = usageStats?.usageCountByCompany || {};
    const companyLatest = usageStats?.latestUsageByCompany || {};

    return Object.values(map).sort((a, b) => {
      const latestDiff = (companyLatest[b.company] || 0) - (companyLatest[a.company] || 0);
      if (latestDiff !== 0) return latestDiff;

      const usageDiff = (companyUsage[b.company] || 0) - (companyUsage[a.company] || 0);
      if (usageDiff !== 0) return usageDiff;

      return b.count - a.count || a.company.localeCompare(b.company, "he");
    });
  }, [visibleCoupons, usageStats]);


  const filteredCoupons = useMemo(() => {
    if (!selectedCompany) return visibleCoupons;
    return visibleCoupons.filter((c) => c.company === selectedCompany);
  }, [visibleCoupons, selectedCompany]);

  const onboardingPending = useOnboardingPending();

  const handleSelectCompany = (company: string) => {
    setSheetCompany(company);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* One banner at a time. The walkthrough prompt goes away by itself
            once the first coupon is in, and stacking it above the expiry
            warning turned the top of a new account into a wall of notices. */}
        <OnboardingBanner />
        {onboardingPending ? null : (
          <>
            <ExpiringCouponsBanner coupons={coupons} isLoading={isLoading} />
            {/* Asked only once there is something in the wallet worth
                protecting — see PushNudgeBanner. */}
            <PushNudgeBanner hasCoupons={coupons.length > 0} />
          </>
        )}

        {/* Wallet Hero Card */}
        <WalletHeroCard
          coupons={coupons}
          isLoading={isLoading}
          isError={isError}
        />

        {/* Company Cards Slider */}
        <CompanyCardsSlider
          companyCards={companyCards}
          selectedCompany={selectedCompany}
          onSelectCompany={handleSelectCompany}
        />

        {/* Selected Company Clear Filter Header */}
        {selectedCompany ? (
          <View style={styles.filterBanner}>
            <TouchableOpacity
              onPress={() => setSelectedCompany(null)}
              style={[styles.clearFilterBtn, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={[styles.clearFilterText, { color: theme.primary }]}>
                הצג את כל החברות
              </Text>
            </TouchableOpacity>
            <Text style={[styles.filterTitle, { color: theme.text }]}>
              קופונים של {selectedCompany} ({filteredCoupons.length})
            </Text>
          </View>
        ) : (
          <View style={styles.sectionHeader}>
            <TouchableOpacity
              onPress={() => router.navigate("/coupons")}
              style={styles.seeAllBtn}
            >
              <ChevronLeft size={16} color={theme.primary} />
              <Text style={[styles.seeAllText, { color: theme.primary }]}>
                לכל הקופונים ({visibleCoupons.length})
              </Text>
            </TouchableOpacity>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              קופונים פעילים
            </Text>
          </View>
        )}

        {/* List of Recent Active Coupons */}
        {filteredCoupons.length > 0 ? (
          filteredCoupons.slice(0, selectedCompany ? 20 : 6).map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              tags={tagsMap[coupon.id] || []}
              onPress={() => router.push(`/coupons/${coupon.id}`)}
              onReportUsage={() => {
                setUsageCoupon(coupon);
                setIsUsageOpen(true);
              }}
            />
          ))
        ) : (
          <EmptyState
            icon={<Sparkles size={32} color={theme.primary} />}
            title="אין קופונים להצגה"
            subtitle="הוסף את הקופון הראשון שלך ותתחיל לחסוך כסף!"
            actionTitle="הוסף קופון חדש"
            onAction={() => router.push("/scanner")}
          />
        )}
      </ScrollView>

      {/* Modals */}
      <QuickUsageModal
        visible={isUsageOpen}
        onClose={() => {
          setIsUsageOpen(false);
          setUsageCoupon(null);
        }}
        coupons={coupons}
        preselectedCoupon={usageCoupon}
      />

      <CompanySheet
        company={sheetCompany}
        coupons={visibleCoupons}
        onClose={() => setSheetCompany(null)}
      />
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
    paddingTop: 14,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "800",
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "700",
  },
  filterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  filterTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
  },
  clearFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
