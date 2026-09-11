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
import { ChevronLeft, ChevronRight, Sparkles, Wallet } from "lucide-react-native";
import { CouponAccessHero } from "@/components/dashboard/CouponAccessHero";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";
import { OnboardingBanner, useOnboardingPending } from "@/components/layout/OnboardingBanner";
import { PushNudgeBanner } from "@/components/layout/PushNudgeBanner";
import { CouponCard } from "@/components/coupons/CouponCard";
import { CouponCardSkeleton } from "@/components/coupons/CouponCardSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCoupons, DecryptedCoupon } from "@/hooks/useCoupons";
import { useCouponUsageStats } from "@/hooks/useCouponUsage";
import { useCouponTagsMap } from "@/hooks/useTags";
import { useContentWidth } from "@/hooks/useContentWidth";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";
import { isSpendableCoupon, totalRemainingValue } from "@/lib/couponTotals";
import { widgetSelection } from "@/lib/widgetSelection";
import { expiringSoon } from "@/lib/homeHero";
import { couponRouteId } from "@/lib/couponId";

/**
 * An alternative home screen, reachable only from the admin panel while it is
 * being tried out. The tab bar still opens `DashboardScreen`; nothing here
 * changes what a regular user sees.
 *
 * What it is testing: the wallet screen as a way into a coupon rather than a
 * summary of the wallet. The order is fixed — one line from the mascot, the
 * search field, quick filters, then coupons — so that on a standard iPhone the
 * first card is already on screen before any scrolling. The balance keeps its
 * place at the bottom: people open this app to spend the money, not to admire
 * the total.
 *
 * `ExpiringCouponsBanner` is deliberately absent. The hero already says how many
 * coupons are close to expiring, from the same `homeHero` numbers, and showing
 * both means saying it twice above the fold. The banner is untouched and still
 * used by the current dashboard.
 */

/** Cards in the "use these first" section. */
const MAX_EXPIRING_CARDS = 3;
/** Cards in the "recently used" section below it. */
const MAX_FAVORITE_CARDS = 5;

export function HomeAltScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const width = useContentWidth();
  const isTablet = width >= 768;
  const { data: coupons = [], isLoading, refetch, isRefetching } = useCoupons();
  const { data: usageStats } = useCouponUsageStats(coupons);
  const { data: tagsMap = {} } = useCouponTagsMap();
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  // Set when a coupon card is held: the usage modal opens on that coupon.
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

  const expiringCards = useMemo(
    () => expiringSoon(coupons).slice(0, MAX_EXPIRING_CARDS).map((entry) => entry.coupon),
    [coupons]
  );

  /**
   * The second section: what the user reaches for. The widget selection comes
   * first — those are the coupons they pinned themselves — and the rest of the
   * row is filled from the recently used ones, skipping anything already shown
   * in the expiring section above.
   */
  const favoriteCards = useMemo(() => {
    const shown = new Set(expiringCards.map((coupon) => coupon.id));
    const picked: DecryptedCoupon[] = [];
    for (const coupon of [...widgetSelection(visibleCoupons), ...visibleCoupons]) {
      if (shown.has(coupon.id)) continue;
      shown.add(coupon.id);
      picked.push(coupon);
      if (picked.length === MAX_FAVORITE_CARDS) break;
    }
    return picked;
  }, [expiringCards, visibleCoupons]);

  const remainingValue = useMemo(() => totalRemainingValue(coupons), [coupons]);

  const renderCard = (coupon: DecryptedCoupon, keyPrefix: string) => (
    <View
      key={`${keyPrefix}-${coupon.id}`}
      style={isTablet ? styles.tabletCouponColumn : undefined}
    >
      <CouponCard
        coupon={coupon}
        tags={tagsMap[coupon.id] || []}
        onPress={() => router.push(`/coupons/${couponRouteId(coupon)}`)}
        onReportUsage={() => {
          setUsageCoupon(coupon);
          setIsUsageOpen(true);
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* The only chrome this screen adds: it is not on the tab bar, so it
          needs its own way back, and it says out loud that it is a debug
          build of the home screen. */}
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
            search. Everything else that used to sit up here moved below. */}
        <OnboardingBanner />

        <CouponAccessHero coupons={coupons} tagsMap={tagsMap} isLoading={isLoading} />

        {isLoading && coupons.length === 0 ? (
          <View>
            {[1, 2].map((item) => (
              <CouponCardSkeleton key={item} />
            ))}
          </View>
        ) : null}

        {expiringCards.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                כדאי להשתמש בקרוב
              </Text>
            </View>
            <View style={isTablet ? styles.tabletCouponGrid : undefined}>
              {expiringCards.map((coupon) => renderCard(coupon, "expiring"))}
            </View>
          </>
        ) : null}

        {favoriteCards.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                בשימוש לאחרונה
              </Text>
            </View>
            <View style={isTablet ? styles.tabletCouponGrid : undefined}>
              {favoriteCards.map((coupon) => renderCard(coupon, "favorite"))}
            </View>
          </>
        ) : null}

        {visibleCoupons.length > 0 ? (
          <TouchableOpacity
            onPress={() => router.navigate("/coupons")}
            style={styles.seeAllBtn}
            accessibilityRole="button"
          >
            <ChevronLeft size={16} color={theme.primary} />
            <Text style={[styles.seeAllText, { color: theme.primary }]}>
              לכל הקופונים ({visibleCoupons.length})
            </Text>
          </TouchableOpacity>
        ) : null}

        {isLoading || visibleCoupons.length === 0 ? null : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.navigate("/statistics")}
            style={[styles.walletStrip, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            accessibilityRole="button"
            accessibilityLabel={`יתרה בארנק, ${formatIls(remainingValue)}`}
          >
            <ChevronLeft size={16} color={theme.textMuted} />
            <View style={styles.walletCopy}>
              <Text style={[styles.walletValue, { color: theme.text }]}>
                {formatIls(remainingValue)} בארנק
              </Text>
              <Text style={[styles.walletCaption, { color: theme.textMuted }]}>
                {visibleCoupons.length} קופונים פעילים
              </Text>
            </View>
            <View style={[styles.walletIcon, { backgroundColor: theme.primaryTint }]}>
              <Wallet size={18} color={theme.primary} />
            </View>
          </TouchableOpacity>
        )}

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
  sectionHeader: {
    alignItems: "flex-end",
    marginBottom: 10,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
  },
  tabletCouponGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
  },
  tabletCouponColumn: {
    width: "49%",
    minWidth: 0,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 2,
    paddingVertical: 10,
  },
  seeAllText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    fontWeight: "700",
  },
  walletStrip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  walletIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  walletCopy: {
    flex: 1,
    alignItems: "flex-end",
  },
  walletValue: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  walletCaption: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
    textAlign: "right",
  },
});
