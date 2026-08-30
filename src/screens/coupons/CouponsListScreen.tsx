import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  I18nManager,
  Image,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Search,
  Plus,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  X,
  QrCode,
  ReceiptText,
} from "lucide-react-native";
import { CouponCard } from "@/components/coupons/CouponCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCoupons, useBulkDeleteCoupons, DecryptedCoupon } from "@/hooks/useCoupons";
import { Swipeable } from "react-native-gesture-handler";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";
import { useCouponUsageStats } from "@/hooks/useCouponUsage";
import { useCouponTagsMap } from "@/hooks/useTags";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { useTriggerAutoUpdate } from "@/hooks/useAutoUpdate";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { couponRouteId } from "@/lib/couponId";
import { notify } from "@/lib/notify";
import { matchesCouponSearch } from "@/lib/couponSearch";
import { companyKey } from "@/lib/companyName";
import { CharacterSpotlight } from "@/components/onboarding/CharacterRig";
import { CouponCardSkeleton } from "@/components/coupons/CouponCardSkeleton";
import { useOfflineWalletStatus } from "@/hooks/useOfflineWalletStatus";
import { WifiOff } from "lucide-react-native";

type FilterStatus = "all" | "active" | "expiring" | "used" | "expired";

interface CouponSection {
  key: string;
  title: string;
  data: DecryptedCoupon[];
}

export function CouponsListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    initialFilterTag?: string;
    initialCompany?: string;
    /** Comma-separated coupon ids, sent by a notification that is about them. */
    ids?: string;
  }>();
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { data: coupons = [], isLoading, refetch, isRefetching } = useCoupons();
  const { data: usageStats } = useCouponUsageStats(coupons);
  const { data: tagsMap = {} } = useCouponTagsMap();
  const bulkDelete = useBulkDeleteCoupons();
  const triggerAutoUpdate = useTriggerAutoUpdate();
  const offline = useOfflineWalletStatus();

  // A notification links here with the exact coupons it was written about, so
  // the list opens on those and not on the whole wallet. Cleared from the
  // banner, which is the only way back to everything.
  const [focusIds, setFocusIds] = useState<string[] | null>(() => {
    const parsed = String(params.ids ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => /^cpn_[0-9a-f]{20}$/.test(value) || /^[1-9][0-9]*$/.test(value));
    return parsed.length ? parsed : null;
  });

  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(
    params.initialFilterTag || null
  );
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  // Status + tag filter rows stay collapsed until the filter button is pressed,
  // unless we arrived here with a tag already applied.
  const [showStatusRow, setShowStatusRow] = useState(
    Boolean(params.initialFilterTag)
  );
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  // Set when a coupon card is held: the usage modal opens on that coupon.
  const [usageCoupon, setUsageCoupon] = useState<DecryptedCoupon | null>(null);

  // Company chips — ordered left-to-right from lowest usage/recency to highest usage/recency, so
  // the right edge (where the row lands after scrollToEnd) is the most recently used/highest-usage company.
  const companyChips = useMemo(() => {
    const counts = coupons.reduce<Record<string, number>>((acc, coupon) => {
      const key = companyKey(coupon.company);
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const companyUsage = usageStats?.usageCountByCompany || {};
    const companyLatest = usageStats?.latestUsageByCompany || {};

    return Object.entries(counts)
      .sort((a, b) => {
        const latestDiff = (companyLatest[a[0]] || 0) - (companyLatest[b[0]] || 0);
        if (latestDiff !== 0) return latestDiff;

        const usageDiff = (companyUsage[a[0]] || 0) - (companyUsage[b[0]] || 0);
        if (usageDiff !== 0) return usageDiff;

        return a[1] - b[1] || a[0].localeCompare(b[0], "he");
      })
      .map(([key]) => {
        // Prefer the exact spelling the user sees on their coupons.
        const source = coupons.find((c) => companyKey(c.company) === key);
        return (source?.company || key).trim();
      });
  }, [coupons, usageStats]);

  const isCompanyFiltered = (coupon: DecryptedCoupon) =>
    !selectedCompany || companyKey(coupon.company) === companyKey(selectedCompany);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    Object.values(tagsMap).forEach((tags) => tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [tagsMap]);

  const matchedCoupons = useMemo(() => {
    return coupons.filter((coupon) => {
      if (pendingDeleteIds.includes(coupon.id)) return false;
      if (focusIds && !focusIds.includes(coupon.public_id) && !focusIds.includes(String(coupon.id))) return false;

      // Search
      if (!matchesCouponSearch(coupon, search)) return false;

      if (!isCompanyFiltered(coupon)) return false;

      // Tag filter
      if (selectedTag) {
        const cTags = tagsMap[coupon.id] || [];
        if (!cTags.includes(selectedTag)) return false;
      }

      return true;
    });
  }, [coupons, focusIds, pendingDeleteIds, search, selectedCompany, selectedTag, tagsMap]);

  const sections = useMemo(() => {
    const active: DecryptedCoupon[] = [];
    const expired: DecryptedCoupon[] = [];
    const used: DecryptedCoupon[] = [];
    const couponUsage = usageStats?.usageCountByCoupon || {};

    for (const coupon of matchedCoupons) {
      const remaining = (coupon.value || 0) - (coupon.used_value || 0);
      const isExpired =
        coupon.expiration && new Date(coupon.expiration).getTime() < Date.now();
      const isUsed = coupon.status === "נוצל" || remaining <= 0;

      const daysLeft = coupon.expiration
        ? Math.ceil((new Date(coupon.expiration).getTime() - Date.now()) / 86400000)
        : null;
      const matchesExpiring = daysLeft !== null && daysLeft >= 0 && daysLeft <= 14;

      if (statusFilter === "expiring" && !matchesExpiring) continue;

      if (isUsed) {
        used.push(coupon);
      } else if (isExpired) {
        expired.push(coupon);
      } else {
        active.push(coupon);
      }
    }

    // Sort coupons in each section descending by latest usage timestamp, then usage frequency, then date_added
    const sortByUsage = (a: DecryptedCoupon, b: DecryptedCoupon) => {
      const latestA = usageStats?.latestUsageByCoupon?.[a.id] || 0;
      const latestB = usageStats?.latestUsageByCoupon?.[b.id] || 0;
      if (latestA !== latestB) return latestB - latestA;

      const usageA = couponUsage[a.id] || 0;
      const usageB = couponUsage[b.id] || 0;
      if (usageA !== usageB) return usageB - usageA;

      const dateA = a.date_added ? new Date(a.date_added).getTime() : 0;
      const dateB = b.date_added ? new Date(b.date_added).getTime() : 0;
      return dateB - dateA;
    };

    active.sort(sortByUsage);
    expired.sort(sortByUsage);
    used.sort(sortByUsage);

    const list: CouponSection[] = [];

    if (statusFilter === "all" || statusFilter === "active" || statusFilter === "expiring") {
      if (active.length > 0) {
        list.push({ key: "active", title: statusFilter === "expiring" ? "פגים בקרוב" : "פעילים", data: active });
      }
    }
    if (statusFilter === "all" || statusFilter === "expired") {
      if (expired.length > 0) {
        list.push({ key: "expired", title: "פגי תוקף:", data: expired });
      }
    }
    if (statusFilter === "all" || statusFilter === "used") {
      if (used.length > 0) {
        list.push({ key: "used", title: "נוצלו במלואם:", data: used });
      }
    }

    return list;
  }, [matchedCoupons, statusFilter, usageStats]);

  const renderedSections = useMemo(
    () => sections.map((section) => ({
      ...section,
      count: section.data.length,
      data: isTablet
        ? Array.from({ length: Math.ceil(section.data.length / 2) }, (_, index) =>
            section.data.slice(index * 2, index * 2 + 2)
          )
        : section.data.map((coupon) => [coupon]),
    })),
    [isTablet, sections]
  );


  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((item) => item !== id);
      setSelectedIds(next);
      if (next.length === 0) setIsSelectMode(false);
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Keep the highest-count company (the right edge of the row) in view when
  // the data first lands or changes.
  const companyScrollRef = React.useRef<ScrollView>(null);
  React.useEffect(() => {
    if (companyChips.length > 0) {
      companyScrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [companyChips]);

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const ids = [...selectedIds];
    setPendingDeleteIds((current) => [...new Set([...current, ...ids])]);
    setSelectedIds([]);
    setIsSelectMode(false);
    const timer = setTimeout(
      () => void bulkDelete.mutateAsync(ids).finally(() => setPendingDeleteIds((current) => current.filter((id) => !ids.includes(id)))),
      5000,
    );
    notify.undo(
      `${ids.length} קופונים הוסרו`,
      "המחיקה תתבצע בעוד 5 שניות.",
      () => {
        clearTimeout(timer);
        setPendingDeleteIds((current) => current.filter((id) => !ids.includes(id)));
      },
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.pageTitle, { color: theme.text }]}>הקופונים שלי</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => triggerAutoUpdate.mutate(undefined)}
            disabled={triggerAutoUpdate.isPending}
            style={[styles.iconBtn, { backgroundColor: theme.surfaceAlt }]}
            accessibilityLabel="עדכון יתרות"
          >
            <RefreshCw
              size={18}
              color={theme.text}
              style={triggerAutoUpdate.isPending ? { opacity: 0.5 } : {}}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowStatusRow((v) => !v)}
            accessibilityLabel="סינון לפי סטטוס"
            style={[
              styles.iconBtn,
              { backgroundColor: showStatusRow ? theme.primaryTint : theme.surfaceAlt },
            ]}
          >
            <SlidersHorizontal size={18} color={showStatusRow ? theme.primary : theme.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/scanner")}
            accessibilityLabel="סריקת קוד קופון"
            style={[styles.iconBtn, { backgroundColor: theme.surfaceAlt }]}
          >
            <QrCode size={18} color={theme.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/coupons/add")}
            style={[styles.addBtn, { backgroundColor: theme.primary }]}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>הוספת קופון</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.container}>
        {offline.usingCache ? (
          <View
            style={[styles.offlineBanner, { backgroundColor: theme.warningBg, borderColor: theme.warning }]}
            accessibilityRole="alert"
          >
            <WifiOff size={16} color={theme.warningText} />
            <Text style={[styles.offlineText, { color: theme.warningText }]}>מצב אופליין — מוצגים הנתונים האחרונים שנשמרו</Text>
          </View>
        ) : null}
        {focusIds ? (
          <View style={[styles.focusBanner, { backgroundColor: theme.primaryTint }]}>
            <Text style={[styles.focusText, { color: theme.primary }]}>
              מציג את הקופונים מההתראה
            </Text>
            <TouchableOpacity onPress={() => setFocusIds(null)} hitSlop={8}>
              <Text style={[styles.focusClear, { color: theme.primary }]}>הצג הכל</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Search Bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.card,
              borderColor: theme.inputBorder,
            },
          ]}
        >
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <X size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ) : (
            <Search size={18} color={theme.textMuted} />
          )}
          <TextInput
            placeholder="חיפוש לפי חברה, תיאור או מספר קופון"
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={setSearch}
            textAlign="right"
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        {/* Company chips — ordered by coupon count, most on the right */}
        <ScrollView
          ref={companyScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.companyChipRowContent}
        >
          <TouchableOpacity
            key="all"
            onPress={() => setSelectedCompany(null)}
            style={[
              styles.tagChip,
              {
                backgroundColor: selectedCompany === null ? theme.primary : theme.card,
                borderColor: selectedCompany === null ? theme.primary : theme.inputBorder,
              },
            ]}
          >
            <Text
              style={[styles.tagChipText, { color: selectedCompany === null ? "#ffffff" : theme.label }]}
            >
              הכל
            </Text>
          </TouchableOpacity>

          {(showAllCompanies
            ? companyChips
            : Array.from(new Set([...companyChips.slice(-6), ...(selectedCompany ? [selectedCompany] : [])]))
          ).map((company) => {
            const isCurrent = companyKey(selectedCompany) === companyKey(company);
            const count = coupons.filter(
              (coupon) => companyKey(coupon.company) === companyKey(company)
            ).length;
            return (
              <TouchableOpacity
                key={company}
                onPress={() => setSelectedCompany(isCurrent ? null : company)}
                style={[
                  styles.companyChip,
                  {
                    backgroundColor: isCurrent ? theme.primary : theme.card,
                    borderColor: isCurrent ? theme.primary : theme.inputBorder,
                  },
                ]}
              >
                <Image
                  source={getCompanyLogoSource(company)}
                  style={styles.companyChipLogo}
                  resizeMode="contain"
                />
                <Text
                  numberOfLines={1}
                  style={[styles.companyChipText, { color: isCurrent ? "#ffffff" : theme.label }]}
                >
                  {company}
                </Text>
                <Text
                  style={[styles.companyChipCount, { color: isCurrent ? "rgba(255,255,255,0.85)" : theme.textMuted }]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
          {companyChips.length > 6 ? (
            <TouchableOpacity
              onPress={() => setShowAllCompanies((value) => !value)}
              style={[styles.companyChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.inputBorder }]}
              accessibilityRole="button"
              accessibilityState={{ expanded: showAllCompanies }}
            >
              <Text style={[styles.companyChipText, { color: theme.primary }]}> 
                {showAllCompanies ? "פחות חברות" : `כל החברות (${companyChips.length})`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        {/* Status filter, revealed from the header's filter button */}
        {showStatusRow ? (
          <View style={styles.statusTabsRow}>
            {(
              [
                { key: "all", label: "הכל" },
                { key: "active", label: "פעילים" },
                { key: "expiring", label: "פגים בקרוב" },
                { key: "expired", label: "פגי תוקף" },
                { key: "used", label: "נוצלו" },
              ] as const
            ).map((tab) => {
              const isCurrent = statusFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setStatusFilter(tab.key)}
                  style={[
                    styles.statusTab,
                    {
                      backgroundColor: isCurrent ? theme.primary : theme.card,
                      borderColor: isCurrent ? theme.primary : theme.inputBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusTabText,
                      { color: isCurrent ? "#ffffff" : theme.label },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* Tag Filter Chips (if tags exist), hidden behind the same filter button */}
        {showStatusRow && allTags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            contentContainerStyle={styles.chipRowContent}
          >
            {allTags.map((item) => {
              const isSelected = selectedTag === item;
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => setSelectedTag(isSelected ? null : item)}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.card,
                      borderColor: isSelected ? theme.primary : theme.inputBorder,
                    },
                  ]}
                >
                  <Text
                    style={[styles.tagChipText, { color: isSelected ? "#ffffff" : theme.label }]}
                  >
                    #{item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Multi-Select Action Bar */}
        {isSelectMode ? (
          <View
            style={[
              styles.selectionBar,
              {
                backgroundColor: theme.surfaceAlt,
                borderColor: theme.inputBorder,
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleBulkDelete}
              style={[styles.deleteBtn, { backgroundColor: theme.danger }]}
            >
              <Trash2 size={16} color="#ffffff" />
              <Text style={styles.deleteBtnText}>מחק ({selectedIds.length})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setIsSelectMode(false);
                setSelectedIds([]);
              }}
            >
              <Text style={[styles.cancelSelectText, { color: theme.textMuted }]}>
                ביטול
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Coupons List */}
        <SectionList
          sections={renderedSections}
          keyExtractor={(item: DecryptedCoupon[]) => item.map((coupon) => coupon.id).join("-")}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          renderSectionHeader={({ section: { title, count } }) => (
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderTitleRow}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {title}
                </Text>
                <View style={[styles.sectionBadge, { backgroundColor: theme.surfaceAlt }]}>
                  <Text style={[styles.sectionBadgeText, { color: theme.textSubtle }]}>
                    {count}
                  </Text>
                </View>
              </View>
            </View>
          )}
          renderItem={({ item }: { item: DecryptedCoupon[] }) => (
            <View style={[styles.couponRow, isTablet && styles.tabletCouponRow]}>
              {item.map((coupon) => (
                <View key={coupon.id} style={styles.couponColumn}>
                  <Swipeable
                    overshootLeft={false}
                    overshootRight={false}
                    friction={2}
                    renderRightActions={() => (
                      <TouchableOpacity
                        onPress={() => setUsageCoupon(coupon)}
                        accessibilityLabel={`דיווח שימוש בקופון של ${coupon.company}`}
                        style={[styles.swipeAction, { backgroundColor: theme.success }]}
                      >
                        <ReceiptText size={20} color="#ffffff" />
                        <Text style={styles.swipeActionText}>דיווח שימוש</Text>
                      </TouchableOpacity>
                    )}
                  >
                    <CouponCard
                      coupon={coupon}
                      tags={tagsMap[coupon.id] || []}
                      selected={selectedIds.includes(coupon.id)}
                      showSelect={isSelectMode}
                      onSelect={() => toggleSelect(coupon.id)}
                      onPress={() => {
                        if (isSelectMode) {
                          toggleSelect(coupon.id);
                        } else {
                          router.push(`/coupons/${couponRouteId(coupon)}`);
                        }
                      }}
                      onReportUsage={() => setUsageCoupon(coupon)}
                    />
                  </Swipeable>
                </View>
              ))}
              {isTablet && item.length === 1 ? <View style={styles.couponColumn} /> : null}
            </View>
          )}
          ListEmptyComponent={
            isLoading ? (
              <View>{[1, 2, 3].map((item) => <CouponCardSkeleton key={item} />)}</View>
            ) : <EmptyState
              icon={<CharacterSpotlight character="investigator" state={search || selectedTag ? "thinking" : "talking"} />}
              largeVisual
              title={search || selectedTag ? "לא מצאנו קופון מתאים" : "עוד אין כאן קופונים"}
              subtitle={
                search || selectedTag
                  ? "אפשר לנסות חיפוש אחר או לנקות את הסינון."
                  : "הקופון הראשון שלך מתחיל כאן."
              }
              actionTitle="הוספת קופון"
              onAction={() => router.push("/coupons/add")}
            />
          }
        />
      </View>

      <QuickUsageModal
        visible={Boolean(usageCoupon)}
        onClose={() => setUsageCoupon(null)}
        coupons={coupons}
        preselectedCoupon={usageCoupon}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 12,
  },
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "right",
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    height: 44,
    width: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 12,
    gap: 6,
  },
  offlineBanner: {
    minHeight: 44,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  offlineText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    textAlign: "right",
  },
  swipeAction: {
    width: 88,
    minHeight: 88,
    marginBottom: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  swipeActionText: {
    color: "#ffffff",
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: "800",
  },
  addBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  focusBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    marginBottom: 10,
  },
  focusText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: "600",
  },
  focusClear: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  searchBar: {
    // Keep the icon on the right whether or not the runtime flipped the layout.
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  statusTabsRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  statusTab: {
    minWidth: 92,
    flexGrow: 1,
    minHeight: 44,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: "600",
  },
  chipRow: {
    // An explicit height is required: inside a flex:1 column with the coupon
    // list as a sibling, an auto-height horizontal ScrollView gets squashed to
    // a few pixels and the chips render clipped on top of each other.
    height: 46,
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 12,
  },
  chipRowContent: {
    // row-reverse puts the first chip on the right, as Hebrew expects, while
    // the ScrollView still pans both ways.
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  companyChipRowContent: {
    // row (left-to-right) keeps the highest-count company on the right edge and
    // the lowest-count company on the left edge. The initial scrollToEnd also
    // aligns the row to the right.
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  tagChip: {
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  companyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    maxWidth: 160,
  },
  companyChipLogo: {
    width: 20,
    height: 20,
    borderRadius: 6,
    flexShrink: 0,
  },
  companyChipText: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  companyChipCount: {
    fontSize: 11,
    fontWeight: "800",
    minWidth: 18,
    textAlign: "center",
    flexShrink: 0,
  },
  selectionBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  deleteBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  cancelSelectText: {
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 32,
  },
  couponRow: {
    width: "100%",
  },
  tabletCouponRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  couponColumn: {
    flex: 1,
    minWidth: 0,
  },
  sectionHeader: {
    paddingVertical: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  sectionHeaderTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: "700",
  },
});
