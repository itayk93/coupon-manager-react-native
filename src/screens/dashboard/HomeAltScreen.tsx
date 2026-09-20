import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import Animated from "react-native-reanimated";
import { GestureDetector } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { ChevronLeft, Sparkles } from "lucide-react-native";
import { CouponAccessHero } from "@/components/dashboard/CouponAccessHero";
import { CouponSection } from "@/components/dashboard/CouponSection";
import { CompanyCardsSlider } from "@/components/dashboard/CompanyCardsSlider";
import { CompanySheet } from "@/components/dashboard/CompanySheet";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";
import { OnboardingBanner, useOnboardingPending } from "@/components/layout/OnboardingBanner";
import { PushNudgeBanner } from "@/components/layout/PushNudgeBanner";
import { CouponCardSkeleton } from "@/components/coupons/CouponCardSkeleton";
import { AddCouponFab, FAB_CLEARANCE } from "@/components/ui/AddCouponFab";
import { PullUpIndicator, usePullUpAction } from "@/components/ui/PullUpAction";
import { useContentStyle } from "@/hooks/useResponsive";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCoupons, DecryptedCoupon } from "@/hooks/useCoupons";
import { useCouponUsageStats } from "@/hooks/useCouponUsage";
import { useCouponTagsMap } from "@/hooks/useTags";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { isSpendableCoupon } from "@/lib/couponTotals";
import { companyCards } from "@/lib/companyCards";
import { companyKey } from "@/lib/companyName";
import { widgetSelection } from "@/lib/widgetSelection";
import { expiringSoon } from "@/lib/homeHero";
import { couponRouteId } from "@/lib/couponId";

/**
 * The home screen.
 *
 * It spent a while behind an admin gate and then behind a settings switch,
 * which is why the file is still called `HomeAltScreen` — the name is the only
 * thing left of that. `DashboardScreen` is what it replaced; that file stays in
 * the tree, unreferenced, so the old screen can be read and lifted from rather
 * than reconstructed from git.
 *
 * What it is testing: a home screen that answers "how much do I have, what is
 * about to expire, and what do I reach for" in one glance, and gets out of the
 * way. The mascot holds the balance, the search field is the primary action,
 * and the coupons sit below in two short sections, a card per row.
 *
 * The sections are short on purpose. An earlier version drew them as small
 * tiles in horizontal rails, which gave the screen a shape of its own but cost
 * the card's code, progress bar, copy button and usage button — most of what
 * you open a coupon for. So the card here is `CouponCard`, the one the coupons
 * list and the dashboard render, and what keeps this screen from being the list
 * is the shortlist: `MAX_SECTION_CARDS` a section, not the whole wallet.
 *
 * `ExpiringCouponsBanner` is deliberately absent: the hero already says how
 * many coupons are close, from the same `homeHero` numbers. The banner is
 * untouched and still used by the current dashboard.
 *
 * The end of the page is also a way out of it. Keep dragging once the last
 * section has run out and a tab rises out of the bottom edge offering a new
 * coupon — the one thing this screen is about that is not already on it. See
 * `PullUpAction`; the button in the corner does the same job for anyone who
 * never pulls, so the gesture is only ever a shortcut, never the only door.
 */

/**
 * Cards per section. A full-width card is taller than the tile it replaced, and
 * a home screen you have to scroll to read is the coupons list with extra
 * steps — the link at the foot of the screen is what the rest is for.
 */
const MAX_SECTION_CARDS = 4;

export function HomeAltScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading, refetch, isRefetching } = useCoupons();
  const { data: usageStats } = useCouponUsageStats(coupons);
  const { data: tagsMap = {} } = useCouponTagsMap();
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  // Set when a card is held: the usage modal opens on that coupon.
  const [usageCoupon, setUsageCoupon] = useState<DecryptedCoupon | null>(null);
  // Which company's coupons are open in the sheet — the screen's fast path.
  const [sheetCompany, setSheetCompany] = useState<string | null>(null);
  const onboardingPending = useOnboardingPending();
  // A grid column: this screen is cards filling their width, not a form.
  const contentStyle = useContentStyle("grid");

  // Stable across renders so the gesture is not rebuilt mid-drag.
  const addCoupon = useCallback(() => router.push("/coupons/add"), [router]);
  const pullUp = usePullUpAction({ onTrigger: addCoupon });

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

  const expiring = useMemo(
    () => expiringSoon(coupons).slice(0, MAX_SECTION_CARDS).map((entry) => entry.coupon),
    [coupons]
  );

  // Companies, most recently used first. The ordering is imported rather than
  // re-derived here — see `companyCards` — so a shop is never near the top on
  // one screen and buried on another.
  const cards = useMemo(
    () => companyCards(visibleCoupons, usageStats),
    [visibleCoupons, usageStats]
  );

  const sheetCoupons = useMemo(
    () =>
      sheetCompany
        ? visibleCoupons.filter((coupon) => companyKey(coupon.company) === companyKey(sheetCompany))
        : [],
    [visibleCoupons, sheetCompany]
  );

  /**
   * The second section: what the user reaches for. Coupons they pinned to the
   * widget come first, then the recently used ones, skipping anything the
   * expiring section is already showing.
   */
  const favourites = useMemo(() => {
    const shown = new Set(expiring.map((coupon) => coupon.id));
    const picked: DecryptedCoupon[] = [];
    for (const coupon of [...widgetSelection(visibleCoupons), ...visibleCoupons]) {
      if (shown.has(coupon.id)) continue;
      shown.add(coupon.id);
      picked.push(coupon);
      if (picked.length === MAX_SECTION_CARDS) break;
    }
    return picked;
  }, [expiring, visibleCoupons]);

  // Counted off the same grid the tile now opens, so the number on it and the
  // number of tiles on the companies screen cannot disagree.
  const companyCount = cards.length;

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
      <GestureDetector gesture={pullUp.gesture}>
        <Animated.ScrollView
          ref={pullUp.scrollRef}
          onScroll={pullUp.scrollHandler}
          scrollEventThrottle={16}
          style={styles.container}
          contentContainerStyle={[styles.scrollContent, contentStyle]}
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

          <CouponAccessHero coupons={coupons} isLoading={isLoading} />

          {/* The fast path, as high as the screen allows. Someone opening this
              app is usually at a till: they know the shop and need the barcode,
              so naming the shop is the shortest route there. Same component and
              same ordering as the dashboard, so a shop is never near the top on
              one screen and buried on the other. */}
          <CompanyCardsSlider
            companyCards={cards}
            selectedCompany={sheetCompany}
            onSelectCompany={setSheetCompany}
          />

          {isLoading && coupons.length === 0 ? (
            <View style={styles.skeletons}>
              {[1, 2].map((item) => (
                <CouponCardSkeleton key={item} />
              ))}
            </View>
          ) : null}

          <CouponSection
            title="כדאי להשתמש בקרוב"
            coupons={expiring}
            tagsMap={tagsMap}
            keyPrefix="expiring"
            onOpen={openCoupon}
            onReportUsage={reportUsage}
          />
          <CouponSection
            title="בשימוש לאחרונה"
            coupons={favourites}
            tagsMap={tagsMap}
            keyPrefix="favourite"
            onOpen={openCoupon}
            onReportUsage={reportUsage}
          />

          {visibleCoupons.length > 0 ? (
            <>
              {/* Each tile names the filter it wants, including the one that
                  wants none of them. The list is a tab route, so it is usually
                  still mounted with whatever filter the last tile set: two of
                  these used to travel with no params at all, which the list
                  reads as "nothing to apply" — so after "פגים בקרוב" the other
                  two landed on a list still filtered to what is expiring. */}
              <View style={styles.statsRow}>
                {stat(String(visibleCoupons.length), "קופונים פעילים", () =>
                  router.navigate({ pathname: "/coupons", params: { initialStatus: "active" } })
                )}
                {stat(String(companyCount), "חברות", () => router.push("/companies"))}
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
        </Animated.ScrollView>
      </GestureDetector>

      {/* Under the page and behind the button, so the pull draws it out of the
          bottom edge instead of dropping it on top of the content. */}
      <PullUpIndicator travel={pullUp.travel} armed={pullUp.armed} label="קופון חדש" />

      {/* Outside the ScrollView so it stays put while the page moves under it:
          adding a coupon is the one thing this screen is for that is not about
          a coupon already in the wallet. */}
      <AddCouponFab />

      <CompanySheet
        company={sheetCompany}
        coupons={sheetCoupons}
        onClose={() => setSheetCompany(null)}
      />

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
    // Enough that the last thing on the page can be scrolled clear of the
    // button rather than ending underneath it.
    paddingBottom: FAB_CLEARANCE + 16,
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
