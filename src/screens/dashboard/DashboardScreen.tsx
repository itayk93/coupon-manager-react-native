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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Sparkles, ChevronLeft } from "lucide-react-native";
import { WalletHeroCard } from "@/components/dashboard/WalletHeroCard";
import { ExpiringCouponsBanner } from "@/components/dashboard/ExpiringCouponsBanner";
import { OnboardingBanner, useOnboardingPending } from "@/components/layout/OnboardingBanner";
import { PushNudgeBanner } from "@/components/layout/PushNudgeBanner";
import { PushPrimer } from "@/components/layout/PushPrimer";
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
import { companyKey } from "@/lib/companyName";
import { widgetSelection } from "@/lib/widgetSelection";
import { CharacterScene } from "@/components/onboarding/CharacterRig";

export function DashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ saved?: string }>();
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading, isError, refetch, isRefetching } = useCoupons();
  const { data: usageStats } = useCouponUsageStats(coupons);
  const { data: tagsMap = {} } = useCouponTagsMap();
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  // Set when a coupon card is held: the usage modal opens on that coupon.
  const [usageCoupon, setUsageCoupon] = useState<DecryptedCoupon | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [sheetCompany, setSheetCompany] = useState<string | null>(null);
  const [showSavedCelebration, setShowSavedCelebration] = useState(params.saved === "1");

  React.useEffect(() => {
    if (params.saved !== "1") return;
    router.setParams({ saved: undefined });
  }, [params.saved, router]);

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
        const key = companyKey(coupon.company);
        const company = (coupon.company || "ללא חברה").trim();
        acc[key] = acc[key] || { company, count: 0 };
        acc[key].count += 1;
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
    return visibleCoupons.filter(
      (c) => companyKey(c.company) === companyKey(selectedCompany)
    );
  }, [visibleCoupons, selectedCompany]);

  const favoriteCoupons = useMemo(() => widgetSelection(filteredCoupons), [filteredCoupons]);

  const expiringCoupons = useMemo(() => {
    const now = Date.now();
    const expiryLimit = now + 14 * 86400000;
    return filteredCoupons.filter((coupon) => {
      if (!coupon.expiration) return false;
      const expiry = new Date(coupon.expiration).getTime();
      return !Number.isNaN(expiry) && expiry >= now && expiry <= expiryLimit;
    }).sort((a, b) => {
      const expiryA = a.expiration ? new Date(a.expiration).getTime() : Number.POSITIVE_INFINITY;
      const expiryB = b.expiration ? new Date(b.expiration).getTime() : Number.POSITIVE_INFINITY;
      const urgencyA = expiryA === Number.POSITIVE_INFINITY ? expiryA : Math.max(0, expiryA - now);
      const urgencyB = expiryB === Number.POSITIVE_INFINITY ? expiryB : Math.max(0, expiryB - now);
      if (urgencyA !== urgencyB) return urgencyA - urgencyB;
      return ((b.value || 0) - (b.used_value || 0)) - ((a.value || 0) - (a.used_value || 0));
    });
  }, [filteredCoupons]);

  const onboardingPending = useOnboardingPending();

  const handleSelectCompany = (company: string) => {
    setSheetCompany(company);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Our own ask, before the OS spends its one permission dialog. */}
      <PushPrimer />

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
        {showSavedCelebration ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowSavedCelebration(false)}
            style={[styles.successCard, { backgroundColor: theme.successBg }]}
            accessibilityRole="button"
            accessibilityLabel="הקופון נשמר בארנק. סגירת ההודעה"
          >
            <View style={styles.successVisual}><CharacterScene state="success" compact /></View>
            <View style={styles.successCopy}>
              <Text style={[styles.successTitle, { color: theme.successText }]}>הקופון נשמר בארנק</Text>
              <Text style={[styles.successText, { color: theme.successText }]}>הוא מוכן למימוש. לחיצה סוגרת את ההודעה.</Text>
            </View>
          </TouchableOpacity>
        ) : null}
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

        {favoriteCoupons.length > 0 ? (
          <>
            <View style={styles.sectionHeaderOnly}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>קופונים מועדפים</Text>
            </View>
            {favoriteCoupons.map((coupon) => (
              <CouponCard
                key={`favorite-${coupon.id}`}
                coupon={coupon}
                tags={tagsMap[coupon.id] || []}
                onPress={() => router.push(`/coupons/${coupon.id}`)}
                onReportUsage={() => {
                  setUsageCoupon(coupon);
                  setIsUsageOpen(true);
                }}
              />
            ))}
          </>
        ) : null}

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
              <ChevronLeft size={16} color={theme.textMuted} />
              <Text style={[styles.seeAllText, { color: theme.textMuted }]}>
                לכל הקופונים ({visibleCoupons.length})
              </Text>
            </TouchableOpacity>
            <Text style={[styles.sectionTitle, { color: theme.text }]}> 
              דורש טיפול
            </Text>
          </View>
        )}

        {/* List of Recent Active Coupons */}
        {expiringCoupons.length > 0 ? (
          expiringCoupons.map((coupon) => (
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
        ) : visibleCoupons.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={32} color={theme.primary} />}
            title="אין קופונים להצגה"
            subtitle="הוסף את הקופון הראשון שלך ותתחיל לחסוך כסף!"
            actionTitle="הוספת קופון"
            onAction={() => router.push("/scanner")}
          />
        ) : null}
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
  sectionHeaderOnly: {
    alignItems: "flex-end",
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
  successCard: {
    minHeight: 116,
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 14,
    overflow: "hidden",
  },
  successVisual: {
    width: 128,
    height: 110,
    overflow: "hidden",
  },
  successCopy: {
    flex: 1,
    alignItems: "flex-end",
  },
  successTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  successText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "right",
    marginTop: 3,
  },
});
