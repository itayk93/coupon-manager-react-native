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
import { Header } from "@/components/ui/Header";
import { WalletHeroCard } from "@/components/dashboard/WalletHeroCard";
import { CompanyCardsSlider } from "@/components/dashboard/CompanyCardsSlider";
import { QuickAddModal } from "@/components/dashboard/QuickAddModal";
import { StatsModal } from "@/components/dashboard/StatsModal";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";
import { CouponCard } from "@/components/coupons/CouponCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCoupons, DecryptedCoupon } from "@/hooks/useCoupons";
import { useCouponTagsMap } from "@/hooks/useTags";
import { useAppTheme } from "@/contexts/ThemeContext";

export function DashboardScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading, isError, refetch, isRefetching } = useCoupons();
  const { data: tagsMap = {} } = useCouponTagsMap();

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const companyPriority = [
    "Carrefour",
    "קרפור",
    "מגה ספורט",
    "GoodPharm",
    "XTRA",
    "פולגת",
    "BuyMe",
    "Dream Card",
    "Power Gift",
  ];

  const visibleCoupons = useMemo(() => {
    return coupons.filter((c) => !c.is_for_sale && c.status !== "נוצל");
  }, [coupons]);

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

    return Object.values(map).sort((a, b) => {
      const priorityA = companyPriority.indexOf(a.company);
      const priorityB = companyPriority.indexOf(b.company);
      if (priorityA !== -1 || priorityB !== -1) {
        return (priorityA === -1 ? 999 : priorityA) - (priorityB === -1 ? 999 : priorityB);
      }
      return b.count - a.count || a.company.localeCompare(b.company, "he");
    });
  }, [visibleCoupons]);

  const filteredCoupons = useMemo(() => {
    if (!selectedCompany) return visibleCoupons;
    return visibleCoupons.filter((c) => c.company === selectedCompany);
  }, [visibleCoupons, selectedCompany]);

  const handleSelectCompany = (company: string) => {
    if (selectedCompany === company) {
      setSelectedCompany(null);
    } else {
      setSelectedCompany(company);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header
        title="Coupon Master"
        showNotifications
        onNotificationsPress={() => router.push("/notifications")}
      />

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
        {/* Wallet Hero Card */}
        <WalletHeroCard
          coupons={coupons}
          isLoading={isLoading}
          isError={isError}
          onQuickAdd={() => setIsQuickAddOpen(true)}
          onViewStats={() => setIsStatsOpen(true)}
          onReportUsage={() => setIsUsageOpen(true)}
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
              style={[styles.clearFilterBtn, { backgroundColor: theme.isDark ? "#1e293b" : "#f1f5f9" }]}
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
            />
          ))
        ) : (
          <EmptyState
            icon={<Sparkles size={32} color={theme.primary} />}
            title="אין קופונים להצגה"
            subtitle="הוסף את הקופון הראשון שלך ותתחיל לחסוך כסף!"
            actionTitle="הוסף קופון חדש"
            onAction={() => setIsQuickAddOpen(true)}
          />
        )}
      </ScrollView>

      {/* Modals */}
      <QuickAddModal
        visible={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
      />

      <StatsModal
        visible={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        coupons={coupons}
      />

      <QuickUsageModal
        visible={isUsageOpen}
        onClose={() => setIsUsageOpen(false)}
        coupons={coupons}
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
    paddingTop: 12,
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
