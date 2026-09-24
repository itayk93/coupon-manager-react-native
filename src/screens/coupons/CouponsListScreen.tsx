import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  LayoutWidth,
  useContentStyle,
  useDuoPanes,
  useResponsive,
} from "@/hooks/useResponsive";
import {
  Search,
  Plus,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  X,
  QrCode,
  ReceiptText,
  Sparkles,
  ArrowLeft,
  CircleCheck,
  CircleAlert,
} from "lucide-react-native";
import { CouponCard } from "@/components/coupons/CouponCard";
import { CompanyFilterSheet } from "@/components/coupons/CompanyFilterSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useCoupons, useBulkDeleteCoupons, useRestoreCoupons, DecryptedCoupon } from "@/hooks/useCoupons";
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
import { CouponCardSkeleton } from "@/components/coupons/CouponCardSkeleton";
import { useOfflineWalletStatus } from "@/hooks/useOfflineWalletStatus";
import { WifiOff } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { isMerchantQuery, useCouponMerchantSearch } from "@/hooks/useCouponMerchantSearch";
import { formatIls } from "@/lib/formatIls";
import { CouponDetailScreen } from "@/screens/coupons/CouponDetailScreen";

type FilterStatus = "all" | "active" | "expiring" | "used" | "expired";

const FILTER_STATUSES: FilterStatus[] = ["all", "active", "expiring", "used", "expired"];

/** A status handed to us in the URL is only a status if it is one of ours. */
function asFilterStatus(value: unknown): FilterStatus | null {
  return FILTER_STATUSES.includes(value as FilterStatus) ? (value as FilterStatus) : null;
}

/** Below this a coupon card stops showing what it has to show. */
const COUPON_CARD_MIN_WIDTH = 320;

/**
 * The coupons column: a pane of its own in the duo layout, the whole screen
 * otherwise.
 *
 * `LayoutWidth` is what makes the pane honest. Inside it `useResponsive`
 * answers for the pane rather than the window, so the list at 460pt lays
 * itself out as the phone screen it now is — one card per row, phone gutters —
 * while the iPad around it stays an iPad. Without it the list would keep
 * reading 1194pt and pair up cards that have nowhere near the room for it.
 *
 * `width === null` is the phone, and it is a pass-through — the phone's only
 * change is the one flex wrapper the row needs, which a column of the same
 * height lays out identically.
 */
function ListPane({
  width,
  children,
}: {
  width: number | null;
  children: React.ReactNode;
}) {
  if (width === null) return <>{children}</>;
  return (
    <View style={{ width }}>
      <LayoutWidth width={width}>{children}</LayoutWidth>
    </View>
  );
}

const NO_TAGS: string[] = [];

/**
 * One swipeable card in the list. Memoized with stable callbacks, so typing in
 * the search box or picking a filter re-renders only the cards whose own props
 * changed, not every card on screen.
 */
const CouponListItem = React.memo(function CouponListItem({
  coupon,
  tags,
  selected,
  isSelectMode,
  actionColor,
  onToggleSelect,
  onShow,
  onReportUsage,
}: {
  coupon: DecryptedCoupon;
  tags: string[];
  selected: boolean;
  isSelectMode: boolean;
  actionColor: string;
  onToggleSelect: (id: number) => void;
  onShow: (coupon: DecryptedCoupon) => void;
  onReportUsage: (coupon: DecryptedCoupon) => void;
}) {
  return (
    <View style={styles.couponColumn}>
      <Swipeable
        overshootLeft={false}
        overshootRight={false}
        friction={2}
        renderRightActions={() => (
          <TouchableOpacity
            onPress={() => onReportUsage(coupon)}
            accessibilityLabel={`דיווח שימוש בקופון של ${coupon.company}`}
            style={[styles.swipeAction, { backgroundColor: actionColor }]}
          >
            <ReceiptText size={20} color="#ffffff" />
            <Text style={styles.swipeActionText}>דיווח שימוש</Text>
          </TouchableOpacity>
        )}
      >
        <CouponCard
          coupon={coupon}
          tags={tags}
          selected={selected}
          showSelect={isSelectMode}
          onSelect={() => onToggleSelect(coupon.id)}
          onPress={() => {
            if (isSelectMode) {
              onToggleSelect(coupon.id);
            } else {
              onShow(coupon);
            }
          }}
          onReportUsage={() => onReportUsage(coupon)}
        />
      </Swipeable>
    </View>
  );
});

interface CouponSection {
  key: string;
  title: string;
  data: DecryptedCoupon[];
}

export function CouponsListScreen() {
  const contentStyle = useContentStyle("grid");
  const router = useRouter();
  const params = useLocalSearchParams<{
    initialFilterTag?: string;
    initialCompany?: string;
    /** Text typed somewhere else — the home screen's search field — to open on. */
    initialSearch?: string;
    /** Status row to land on, e.g. the home screen's "expiring" quick filter. */
    initialStatus?: string;
    /** Comma-separated coupon ids, sent by a notification that is about them. */
    ids?: string;
  }>();
  const { theme } = useAppTheme();
  // Two cards abreast once two of them actually fit, asked of the column the
  // cards are in rather than of the device. Inside the duo layout that column
  // is the list pane, so a 380pt pane on a 1366pt iPad correctly says one.
  //
  // A width threshold cannot answer this: an iPad mini gives the content 652pt
  // once the rail has its side, and two cards there would be 292pt each —
  // narrower than the card works at, on a device any "is this a tablet" test
  // says yes to.
  const { columns } = useResponsive();
  const isTablet = columns(COUPON_CARD_MIN_WIDTH, 2) > 1;
  const { split, listWidth, detailWidth, gap } = useDuoPanes();
  // Which coupon the detail pane is showing. Only the duo layout has one; on a
  // phone the detail is a pushed route and this stays null.
  const [openCoupon, setOpenCoupon] = useState<string | null>(null);

  /**
   * Open a coupon: into the pane beside the list where there is one, as a
   * pushed route where there is not.
   *
   * Both paths name the coupon the same way, so the pane shows exactly what
   * the route would have.
   */
  const showCoupon = useCallback(
    (coupon: DecryptedCoupon) => {
      const route = couponRouteId(coupon);
      if (split) setOpenCoupon(route);
      else router.push(`/coupons/${route}`);
    },
    [split, router],
  );

  // Rotating an iPad to portrait takes the second column away. Rather than
  // push the open coupon as a route — a navigation the user did not ask for,
  // fired by turning the device — the list simply becomes the whole screen
  // again, one tap from where they were.
  useEffect(() => {
    if (!split) setOpenCoupon(null);
  }, [split]);
  const { data: coupons = [], isLoading, refetch, isRefetching } = useCoupons();
  const { data: usageStats } = useCouponUsageStats(coupons);
  const { data: tagsMap = {} } = useCouponTagsMap();
  const bulkDelete = useBulkDeleteCoupons();
  const restoreCoupons = useRestoreCoupons();
  const triggerAutoUpdate = useTriggerAutoUpdate();
  const offline = useOfflineWalletStatus();
  const { user } = useAuth();
  const showMaintainerAutoUpdate = user?.id === 1;

  // A notification links here with the exact coupons it was written about, so
  // the list opens on those and not on the whole wallet. Cleared from the
  // banner, which is the only way back to everything.
  const parseFocusIds = (raw: unknown): string[] | null => {
    const parsed = String(raw ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => /^cpn_[0-9a-f]{20}$/.test(value) || /^[1-9][0-9]*$/.test(value));
    return parsed.length ? parsed : null;
  };
  const [focusIds, setFocusIds] = useState<string[] | null>(() => parseFocusIds(params.ids));

  // A widget or notification can re-open this screen with a different id set
  // while it is already mounted — keep the focus in step.
  useEffect(() => {
    const next = parseFocusIds(params.ids);
    if (next) setFocusIds(next);
  }, [params.ids]);

  const [search, setSearch] = useState(params.initialSearch || "");
  const [merchantQuery, setMerchantQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(
    params.initialFilterTag || null
  );
  const [statusFilter, setStatusFilter] = useState<FilterStatus>(
    asFilterStatus(params.initialStatus) || "all"
  );
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  // Status + tag filter rows stay collapsed until the filter button is pressed,
  // unless we arrived here with a tag already applied.
  const [showStatusRow, setShowStatusRow] = useState(
    Boolean(params.initialFilterTag || asFilterStatus(params.initialStatus))
  );
  const [companyFilterOpen, setCompanyFilterOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  // Set when a coupon card is held: the usage modal opens on that coupon.
  const [usageCoupon, setUsageCoupon] = useState<DecryptedCoupon | null>(null);
  const [isMerchantResultsOpen, setIsMerchantResultsOpen] = useState(false);

  // The home screen hands this list a search term, a status or a tag to open
  // on. It is a tab route, so it is usually already mounted and the initial
  // state above never runs again — the params have to be applied here too.
  // They are cleared straight after, so searching for the same word twice in a
  // row still works.
  useEffect(() => {
    const nextStatus = asFilterStatus(params.initialStatus);
    const hasSearch = params.initialSearch !== undefined;
    const hasTag = Boolean(params.initialFilterTag);
    if (!hasSearch && nextStatus === null && !hasTag) return;
    if (hasSearch) setSearch(params.initialSearch || "");
    if (nextStatus) setStatusFilter(nextStatus);
    if (hasTag) setSelectedTag(params.initialFilterTag || null);
    if (nextStatus || hasTag) setShowStatusRow(true);
    router.setParams({
      initialSearch: undefined,
      initialStatus: undefined,
      initialFilterTag: undefined,
    });
  }, [params.initialFilterTag, params.initialSearch, params.initialStatus, router]);
  const merchantSearch = useCouponMerchantSearch(merchantQuery);
  const merchantResultIds = useMemo(
    () => new Set([
      ...(merchantSearch.data?.directCouponIds || []),
      ...(merchantSearch.data?.matches || []).map((match) => match.couponId),
    ]),
    [merchantSearch.data?.directCouponIds, merchantSearch.data?.matches],
  );
  const merchantResultCoupons = useMemo(
    () => coupons.filter((coupon) => merchantResultIds.has(coupon.id)),
    [coupons, merchantResultIds],
  );
  const primaryMerchantResult = merchantResultCoupons[0];
  const currentSearchHasMerchantResults =
    search.trim().toLocaleLowerCase("he-IL") === merchantQuery.toLocaleLowerCase("he-IL");

  const startMerchantSearch = () => {
    const query = search.trim();
    if (!isMerchantQuery(query)) return;
    Keyboard.dismiss();
    if (query.toLocaleLowerCase("he-IL") === merchantQuery.toLocaleLowerCase("he-IL")) {
      void merchantSearch.refetch();
      return;
    }
    setMerchantQuery(query);
  };

  // Only coupons the user can still walk into a shop and use. A company whose
  // coupons are all spent or expired has no place in the filter row.
  const usableCoupons = useMemo(
    () =>
      coupons.filter((coupon) => {
        const remaining = (coupon.value || 0) - (coupon.used_value || 0);
        if (coupon.status === "נוצל" || remaining <= 0) return false;
        if (coupon.expiration && new Date(coupon.expiration).getTime() < Date.now()) return false;
        return true;
      }),
    [coupons]
  );

  // Company chips — ordered left-to-right from lowest usage/recency to highest usage/recency, so
  // the right edge (where the row lands after scrollToEnd) is the most recently used/highest-usage company.
  const companyChips = useMemo(() => {
    const counts = usableCoupons.reduce<Record<string, number>>((acc, coupon) => {
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
        const source = usableCoupons.find((c) => companyKey(c.company) === key);
        return (source?.company || key).trim();
      });
  }, [usableCoupons, usageStats]);

  const companyFilterEntries = useMemo(
    () =>
      [...companyChips].reverse().map((name) => ({
        name,
        count: usableCoupons.filter((coupon) => companyKey(coupon.company) === companyKey(name)).length,
      })),
    [companyChips, usableCoupons]
  );

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
      if (
        !matchesCouponSearch(coupon, search) &&
        !(currentSearchHasMerchantResults && merchantResultIds.has(coupon.id))
      ) return false;

      if (!isCompanyFiltered(coupon)) return false;

      // Tag filter
      if (selectedTag) {
        const cTags = tagsMap[coupon.id] || [];
        if (!cTags.includes(selectedTag)) return false;
      }

      return true;
    });
  }, [coupons, currentSearchHasMerchantResults, focusIds, merchantResultIds, pendingDeleteIds, search, selectedCompany, selectedTag, tagsMap]);

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


  // Read through a ref so the callback stays the same across renders and the
  // memoized list items do not all re-render when one selection changes.
  const selectedIdsRef = React.useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const toggleSelect = useCallback((id: number) => {
    const current = selectedIdsRef.current;
    if (current.includes(id)) {
      const next = current.filter((item) => item !== id);
      selectedIdsRef.current = next;
      setSelectedIds(next);
      if (next.length === 0) setIsSelectMode(false);
    } else {
      const next = [...current, id];
      selectedIdsRef.current = next;
      setSelectedIds(next);
    }
  }, []);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

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
    void bulkDelete
      .mutateAsync(ids)
      .finally(() => setPendingDeleteIds((current) => current.filter((id) => !ids.includes(id))));
    notify.undo(
      `${ids.length} קופונים עברו לנמחקו לאחרונה 👋`,
      `אפשר לשחזר אותם מ"נמחקו לאחרונה" בהגדרות, עד 30 יום.`,
      () => {
        setPendingDeleteIds((current) => current.filter((id) => !ids.includes(id)));
        void restoreCoupons.mutateAsync(ids);
      },
      7000,
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={split ? [styles.duo, { gap }] : styles.solo}>
        <ListPane width={split ? listWidth : null}>
          <View style={[styles.titleRow, contentStyle]}>
            <Text style={[styles.pageTitle, { color: theme.text }]}>הקופונים שלי</Text>

            <View style={styles.headerActions}>
              {showMaintainerAutoUpdate ? (
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
              ) : null}

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

              {/* Lands on the scanner's camera mode. It used to push "/scanner"
                  exactly like the button beside it — two controls, one
                  destination, and a decision the reader did not need to make. */}
              <TouchableOpacity
                onPress={() => router.push("/scanner?tab=camera")}
                accessibilityLabel="סריקת קוד קופון במצלמה"
                style={[styles.iconBtn, { backgroundColor: theme.surfaceAlt }]}
              >
                <QrCode size={18} color={theme.text} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/scanner")}
                style={[styles.addBtn, { backgroundColor: theme.primary }]}
                accessibilityLabel="הוספת קופון מטקסט או SMS"
              >
                <Plus size={16} color="#ffffff" />
                <Text style={styles.addBtnText}>הוספת קופון</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.container, contentStyle]}>
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
                placeholder={showMaintainerAutoUpdate ? "באיזו חנות רוצים לקנות?" : "חיפוש לפי חברה, תיאור או מספר קופון"}
                placeholderTextColor={theme.textMuted}
                value={search}
                onChangeText={setSearch}
                textAlign="right"
                returnKeyType="search"
                onSubmitEditing={() => Keyboard.dismiss()}
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>

            {showMaintainerAutoUpdate && isMerchantQuery(search) && !currentSearchHasMerchantResults ? (
              <TouchableOpacity
                onPress={startMerchantSearch}
                accessibilityRole="button"
                accessibilityLabel={`בדיקת הקופונים שלי עבור ${search.trim()}`}
                style={[
                  styles.merchantSearchButton,
                  { backgroundColor: theme.primaryTint, borderColor: theme.primary },
                ]}
              >
                <Sparkles size={15} color={theme.primary} />
                <Text
                  style={[styles.merchantSearchButtonText, { color: theme.primary }]}
                  numberOfLines={1}
                >
                  איזה מהקופונים שלי מתאים?
                </Text>
              </TouchableOpacity>
            ) : null}

            {showMaintainerAutoUpdate && merchantQuery && currentSearchHasMerchantResults ? (
              <TouchableOpacity
                disabled={merchantSearch.isFetching}
                onPress={() => {
                  if (primaryMerchantResult && !merchantSearch.isError) setIsMerchantResultsOpen(true);
                  else void merchantSearch.refetch();
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: merchantSearch.isFetching }}
                accessibilityLabel={
                  merchantSearch.isFetching
                    ? `מחפש קופון ל${merchantQuery}`
                    : primaryMerchantResult
                      ? `בחירה מתוך ${merchantResultCoupons.length} קופונים שמתאימים ל${merchantQuery}`
                      : `בדיקה חוזרת עבור ${merchantQuery}`
                }
                style={[
                  styles.merchantTaskCard,
                  {
                    backgroundColor: merchantSearch.isFetching
                      ? theme.primaryTint
                      : merchantSearch.isError
                        ? theme.dangerBg
                        : primaryMerchantResult
                          ? theme.successBg
                          : theme.surfaceAlt,
                    borderColor: merchantSearch.isFetching
                      ? theme.primary
                      : merchantSearch.isError
                        ? theme.danger
                        : primaryMerchantResult
                          ? theme.success
                          : theme.border,
                  },
                ]}
                accessibilityLiveRegion="polite"
              >
                {merchantSearch.isFetching ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : merchantSearch.isError ? (
                  <CircleAlert size={20} color={theme.danger} />
                ) : primaryMerchantResult ? (
                  <CircleCheck size={20} color={theme.success} />
                ) : (
                  <Search size={20} color={theme.textMuted} />
                )}
                <View style={styles.merchantTaskCopy}>
                  <Text style={[styles.merchantTaskTitle, { color: theme.text }]} numberOfLines={1}>
                    {merchantSearch.isFetching
                      ? `מחפש קופון ל־${merchantQuery}...`
                      : merchantSearch.isError
                        ? "הבדיקה נכשלה — לחיצה לניסיון חוזר"
                        : primaryMerchantResult
                          ? `נמצאו ${merchantResultCoupons.length} קופונים — לחיצה לבחירה`
                          : "לא נמצא קופון — לחיצה לבדיקה חוזרת"}
                  </Text>
                  <Text style={[styles.merchantTaskSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
                    {merchantSearch.isFetching
                      ? "בודק קופונים וכרטיסים כלליים באינטרנט"
                      : primaryMerchantResult
                        ? `מתאימים ל־${merchantQuery}`
                        : "אפשר לשנות את החיפוש או לנסות שוב"}
                  </Text>
                </View>
                {!merchantSearch.isFetching ? (
                  primaryMerchantResult ? (
                    <ArrowLeft size={19} color={theme.primary} />
                  ) : (
                    <RefreshCw size={18} color={merchantSearch.isError ? theme.danger : theme.primary} />
                  )
                ) : null}
              </TouchableOpacity>
            ) : null}

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

              {Array.from(
                new Set([
                  ...companyChips.slice(-5),
                  ...(selectedCompany ? [selectedCompany] : []),
                ])
              ).map((company) => {
                const isCurrent = companyKey(selectedCompany) === companyKey(company);
                const count = usableCoupons.filter(
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
              {companyChips.length > 5 ? (
                <TouchableOpacity
                  onPress={() => setCompanyFilterOpen(true)}
                  style={[styles.companyChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.inputBorder }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.companyChipText, { color: theme.primary }]}>
                    {`כל החברות (${companyChips.length})`}
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
              // Scrolling the results is the signal that the user is done typing —
              // drop the keyboard so the list gets the full screen back.
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
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
                    <CouponListItem
                      key={coupon.id}
                      coupon={coupon}
                      tags={tagsMap[coupon.id] || NO_TAGS}
                      selected={
                        selectedIdSet.has(coupon.id) ||
                        openCoupon === couponRouteId(coupon)
                      }
                      isSelectMode={isSelectMode}
                      actionColor={theme.success}
                      onToggleSelect={toggleSelect}
                      onShow={showCoupon}
                      onReportUsage={setUsageCoupon}
                    />
                  ))}
                  {isTablet && item.length === 1 ? <View style={styles.couponColumn} /> : null}
                </View>
              )}
              ListEmptyComponent={
                isLoading ? (
                  <View>{[1, 2, 3].map((item) => <CouponCardSkeleton key={item} />)}</View>
                ) : showMaintainerAutoUpdate && merchantQuery && currentSearchHasMerchantResults ? null : <EmptyState
                  largeVisual
                  title={search || selectedTag ? "לא מצאנו קופון מתאים" : "עוד אין כאן קופונים"}
                  subtitle={
                    search || selectedTag
                      ? "אפשר לנסות חיפוש אחר או לנקות את הסינון."
                      : "הקופון הראשון שלך מתחיל כאן."
                  }
                  actionTitle="הוספת קופון"
                  onAction={() => router.push("/scanner")}
                />
              }
            />
          </View>
        </ListPane>

        {split ? (
          <View style={[styles.detailPane, { borderColor: theme.cardBorder }]}>
            <LayoutWidth width={detailWidth}>
              {openCoupon ? (
                // Keyed on the coupon, so opening a second one starts the
                // detail screen fresh instead of carrying the first one's
                // scroll position and half-open sheets across.
                <CouponDetailScreen
                  key={openCoupon}
                  couponId={openCoupon}
                  embedded
                  onDismiss={() => setOpenCoupon(null)}
                />
              ) : (
                <View style={styles.detailPlaceholder}>
                  <Text style={[styles.detailPlaceholderText, { color: theme.textMuted }]}>
                    בחרו קופון מהרשימה כדי לראות אותו כאן
                  </Text>
                </View>
              )}
            </LayoutWidth>
          </View>
        ) : null}
      </View>

      <QuickUsageModal
        visible={Boolean(usageCoupon)}
        onClose={() => setUsageCoupon(null)}
        coupons={coupons}
        preselectedCoupon={usageCoupon}
      />

      <CompanyFilterSheet
        visible={companyFilterOpen}
        onClose={() => setCompanyFilterOpen(false)}
        companies={companyFilterEntries}
        selected={selectedCompany}
        onSelect={setSelectedCompany}
      />

      <Modal
        visible={isMerchantResultsOpen}
        onClose={() => setIsMerchantResultsOpen(false)}
        title={`קופונים שמתאימים ל־${merchantQuery}`}
        subtitle={`${merchantResultCoupons.length} אפשרויות זמינות לבחירה`}
        titleIcon={<Sparkles size={18} color={theme.primary} />}
        expandable
      >
        <View style={styles.merchantResultsList}>
          {merchantResultCoupons.map((coupon) => {
            const remaining = Math.max(0, (coupon.value || 0) - (coupon.used_value || 0));
            const match = merchantSearch.data?.matches.find((item) => item.couponId === coupon.id);
            return (
              <TouchableOpacity
                key={coupon.id}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`בחירת קופון ${coupon.company}, יתרה ${formatIls(remaining)}`}
                onPress={() => {
                  setIsMerchantResultsOpen(false);
                  showCoupon(coupon);
                }}
                style={[
                  styles.merchantResultOption,
                  { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                ]}
              >
                <ArrowLeft size={19} color={theme.primary} />
                <View style={styles.merchantResultOptionCopy}>
                  <Text style={[styles.merchantResultOptionTitle, { color: theme.text }]}>
                    {coupon.company}
                  </Text>
                  <Text style={[styles.merchantResultOptionBalance, { color: theme.primary }]}>
                    יתרה {formatIls(remaining)}
                  </Text>
                  <Text style={[styles.merchantResultOptionReason, { color: theme.textMuted }]}>
                    {match?.reason || "התאמה ישירה לשם בית העסק"}
                  </Text>
                </View>
                <View style={[styles.merchantResultOptionLogo, { backgroundColor: theme.card }]}>
                  <Image
                    source={getCompanyLogoSource(coupon.company)}
                    style={styles.merchantResultOptionLogoImage}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
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
  // The list and the coupon it opened, side by side. row-reverse because the
  // list belongs on the right, where reading starts.
  duo: {
    flex: 1,
    flexDirection: "row-reverse",
  },
  // What the screen is on every width below the split: one column, untouched.
  solo: {
    flex: 1,
  },
  detailPane: {
    flex: 1,
    minWidth: 0,
    // A rule rather than a gap, so the two columns read as one screen split
    // instead of two windows that happen to be adjacent.
    borderStartWidth: 1,
  },
  detailPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  detailPlaceholderText: {
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: "center",
    writingDirection: "rtl",
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
  merchantSearchButton: {
    height: 38,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    gap: 6,
    marginTop: -4,
    marginBottom: 10,
  },
  merchantSearchButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "right",
  },
  merchantTaskCard: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  merchantTaskCopy: {
    flex: 1,
    gap: 2,
  },
  merchantTaskTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    fontWeight: "800",
    textAlign: "right",
  },
  merchantTaskSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
  },
  merchantResultsList: {
    gap: 10,
    paddingBottom: 8,
  },
  merchantResultOption: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  merchantResultOptionCopy: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  merchantResultOptionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  merchantResultOptionBalance: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  merchantResultOptionReason: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "right",
  },
  merchantResultOptionLogo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  merchantResultOptionLogoImage: {
    width: 40,
    height: 40,
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
