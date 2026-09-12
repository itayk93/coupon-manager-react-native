import React, { useMemo, useState } from "react";
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
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react-native";
import { CouponAccessHero } from "@/components/dashboard/CouponAccessHero";
import { CouponRail } from "@/components/dashboard/CouponRail";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";
import { OnboardingBanner, useOnboardingPending } from "@/components/layout/OnboardingBanner";
import { PushNudgeBanner } from "@/components/layout/PushNudgeBanner";
import { CouponCardSkeleton } from "@/components/coupons/CouponCardSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCoupons, DecryptedCoupon } from "@/hooks/useCoupons";
import { useCouponUsageStats } from "@/hooks/useCouponUsage";
import { useCouponTagsMap } from "@/hooks/useTags";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { isSpendableCoupon } from "@/lib/couponTotals";
import { companyKey } from "@/lib/companyName";
import { widgetSelection } from "@/lib/widgetSelection";
import { expiringSoon } from "@/lib/homeHero";
import { couponRouteId } from "@/lib/couponId";

/**
 * An alternative home screen, reachable only from the admin panel while it is
 * being tried out. The tab bar still opens `DashboardScreen`; nothing here
 * changes what a regular user sees.
 *
 * What it is testing: a home screen that answers "how much do I have, what is
 * about to expire, and what do I reach for" in one glance, and gets out of the
 * way. The mascot holds the balance, the search field is the primary action,
 * and the coupons sit in short horizontal rails of small tiles.
 *
 * The rails matter. The first version of this screen stacked `CouponCard`s down
 * the page, which is precisely the coupons list — the same component, the same
 * full-width rhythm — so the home screen had nothing of its own to offer.
 * `CouponMiniTile` shows what you need to pick a coupon and lets the next one
 * peek in from the side, which is a shape the list screen never takes.
 *
 * `ExpiringCouponsBanner` is deliberately absent: the hero already says how
 * many coupons are close, from the same `homeHero` numbers. The banner is
 * untouched and still used by the current dashboard.
 */

/** Tiles per rail. A rail is a shortlist, not a listing. */
const MAX_RAIL_TILES = 8;

export function HomeAltScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading, refetch, isRefetching } = useCoupons();
  const { data: usageStats } = useCouponUsageStats(coupons);
  const { data: tagsMap = {} } = useCouponTagsMap();
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  // Set when a tile is held: the usage modal opens on that coupon.
  const [usageCoupon, setUsageCoupon] = useState<DecryptedCoupon | null>(null);
  const onboardingPending = useOnboardingPending();

  // Same ordering the dashboard uses: most recently used first, then most
  // often used, then newest. Imported rather than re-invented so a coupon can
  // never be "recent" on one screen and buried on the other.
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

  const expiring = useMemo(() => expiringSoon(coupons).slice(0, MAX_RAIL_TILES), [coupons]);

  /**
   * The second rail: what the user reaches for. Coupons they pinned to the
   * widget come first, then the recently used ones, skipping anything the
   * expiring rail is already showing.
   */
  const favourites = useMemo(() => {
    const shown = new Set(expiring.map((entry) => entry.coupon.id));
    const picked: DecryptedCoupon[] = [];
    for (const coupon of [...widgetSelection(visibleCoupons), ...visibleCoupons]) {
      if (shown.has(coupon.id)) continue;
      shown.add(coupon.id);
      picked.push(coupon);
      if (picked.length === MAX_RAIL_TILES) break;
    }
    return picked;
  }, [expiring, visibleCoupons]);

  const companyCount = useMemo(
    () => new Set(visibleCoupons.map((coupon) => companyKey(coupon.company))).size,
    [visibleCoupons]
  );

  const openCoupon = (coupon: DecryptedCoupon) =>
    router.push(`/coupons/${couponRouteId(coupon)}`);

  const reportUsage = (coupon: DecryptedCoupon) => {
    setUsageCoupon(coupon);
    setIsUsageOpen(true);
  };

  const stat = (value: string, label: string, onPress: () => void) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* The only chrome this screen adds: it is not on the tab bar, so it needs
          its own way back, and it says out loud that it is a debug build of the
          home screen. */}
      <View style={[styles.debugBar, { backgroundColor: theme.warningBg }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="חזרה"
          style={styles.debugBack}
        >
          <ChevronRight size={18} color={theme.warningText} />
        </TouchableOpacity>
        <Text style={[styles.debugText, { color: theme.warningText }]}>
          מסך בית אלטרנטיבי · ניסוי אדמין
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* A new account still gets the walkthrough prompt first — it is the one
            thing more useful than the search field when there is nothing to
            search. */}
        <OnboardingBanner />

        <CouponAccessHero coupons={coupons} tagsMap={tagsMap} isLoading={isLoading} />

        {isLoading && coupons.length === 0 ? (
          <View style={styles.skeletons}>
            {[1, 2].map((item) => (
              <CouponCardSkeleton key={item} />
            ))}
          </View>
        ) : null}

        <CouponRail
          title="כדאי להשתמש בקרוב"
          items={expiring}
          keyPrefix="expiring"
          onOpen={openCoupon}
          onReportUsage={reportUsage}
        />
        <CouponRail
          title="בשימוש לאחרונה"
          items={favourites.map((coupon) => ({ coupon }))}
          keyPrefix="favourite"
          onOpen={openCoupon}
          onReportUsage={reportUsage}
        />

        {visibleCoupons.length > 0 ? (
          <>
            <View style={styles.statsRow}>
              {stat(String(visibleCoupons.length), "קופונים פעילים", () => router.navigate("/coupons"))}
              {stat(String(companyCount), "חברות", () => router.navigate("/coupons"))}
              {stat(String(expiringSoon(coupons).length), "פגים בקרוב", () =>
                router.push({ pathname: "/coupons", params: { initialStatus: "expiring" } })
              )}
            </View>

            <TouchableOpacity
              onPress={() => router.navigate("/coupons")}
              style={styles.seeAllBtn}
              accessibilityRole="button"
            >
              <ChevronLeft size={16} color={theme.primary} />
              <Text style={[styles.seeAllText, { color: theme.primary }]}>לכל הקופונים</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {visibleCoupons.length === 0 && !isLoading ? (
          <EmptyState
            // No second character: the hero's mascot is a few points above this
            // card, and two of him on one screen is one too many.
            visual={<View />}
            icon={<Sparkles size={32} color={theme.primary} />}
            title="הארנק מחכה לקופון הראשון"
            subtitle="מוסיפים קופון ומתחילים לשמור על כל שקל."
            actionTitle="הוספת קופון"
            onAction={() => router.push("/scanner")}
          />
        ) : null}

        {/* Below the coupons on purpose: a permission prompt must not be the
            thing standing between the user and the search field. */}
        {onboardingPending ? null : <PushNudgeBanner hasCoupons={coupons.length > 0} />}
      </ScrollView>

      <QuickUsageModal
        visible={isUsageOpen}
        onClose={() => {
          setIsUsageOpen(false);
          setUsageCoupon(null);
        }}
        coupons={coupons}
        preselectedCoupon={usageCoupon}
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
  debugBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  debugBack: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  debugText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "right",
    writingDirection: "rtl",
  },
  skeletons: {
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 10,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.card,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 19,
    fontWeight: "800",
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    marginTop: 2,
    textAlign: "center",
  },
  seeAllBtn: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 2,
    paddingVertical: 14,
  },
  seeAllText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    fontWeight: "700",
  },
});
