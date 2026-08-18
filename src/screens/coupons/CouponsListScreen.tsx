import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  I18nManager,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Search,
  Plus,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  X,
  Sparkles,
  QrCode,
} from "lucide-react-native";
import { CouponCard } from "@/components/coupons/CouponCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCoupons, useBulkDeleteCoupons, DecryptedCoupon } from "@/hooks/useCoupons";
import { useCouponTagsMap } from "@/hooks/useTags";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { useTriggerAutoUpdate } from "@/hooks/useAutoUpdate";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";

type FilterStatus = "all" | "active" | "used" | "expired";

export function CouponsListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ initialFilterTag?: string; initialCompany?: string }>();
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading, refetch, isRefetching } = useCoupons();
  const { data: tagsMap = {} } = useCouponTagsMap();
  const bulkDelete = useBulkDeleteCoupons();
  const triggerAutoUpdate = useTriggerAutoUpdate();

  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(
    params.initialFilterTag || null
  );
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("active");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  // Status + tag filter rows stay collapsed until the filter button is pressed,
  // unless we arrived here with a tag already applied.
  const [showStatusRow, setShowStatusRow] = useState(
    Boolean(params.initialFilterTag)
  );
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Company chips — ordered left-to-right from fewest to most coupons, so the
  // right edge (where the row lands after scrollToEnd) is the highest-count
  // company and the left edge is the lowest-count company.
  const companyChips = useMemo(() => {
    const counts = coupons.reduce<Record<string, number>>((acc, coupon) => {
      const company = (coupon.company || "").trim();
      if (company) acc[company] = (acc[company] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "he"))
      .map(([company]) => company);
  }, [coupons]);

  const isCompanyFiltered = (coupon: DecryptedCoupon) =>
    !selectedCompany || (coupon.company || "").trim() === selectedCompany;

  const allTags = useMemo(() => {
    const set = new Set<string>();
    Object.values(tagsMap).forEach((tags) => tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [tagsMap]);

  const filteredCoupons = useMemo(() => {
    return coupons.filter((coupon) => {
      // Search
      const term = search.trim().toLowerCase();
      const matchSearch =
        !term ||
        (coupon.company || "").toLowerCase().includes(term) ||
        (coupon.description || "").toLowerCase().includes(term) ||
        (coupon.code || "").toLowerCase().includes(term);

      if (!matchSearch) return false;

      if (!isCompanyFiltered(coupon)) return false;

      // Tag filter
      if (selectedTag) {
        const cTags = tagsMap[coupon.id] || [];
        if (!cTags.includes(selectedTag)) return false;
      }

      // Status filter
      const remaining = (coupon.value || 0) - (coupon.used_value || 0);
      const isExpired =
        coupon.expiration && new Date(coupon.expiration).getTime() < Date.now();
      const isUsed = coupon.status === "נוצל" || remaining <= 0;

      if (statusFilter === "active") {
        return !isUsed && !isExpired;
      }
      if (statusFilter === "used") {
        return isUsed;
      }
      if (statusFilter === "expired") {
        return isExpired && !isUsed;
      }
      return true; // "all"
    });
  }, [coupons, search, selectedCompany, selectedTag, statusFilter, tagsMap]);

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
    notify.confirm(
      "מחיקת קופונים",
      `האם אתה בטוח שברצונך למחוק ${selectedIds.length} קופונים שנבחרו?`,
      async () => {
        await bulkDelete.mutateAsync(selectedIds);
        setSelectedIds([]);
        setIsSelectMode(false);
      },
      "מחק"
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
            <Text style={styles.addBtnText}>קופון חדש</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.container}>
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
            placeholder="חיפוש לפי חברה, תיאור או קוד"
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

          {companyChips.map((company) => {
            const isCurrent = selectedCompany === company;
            const count = coupons.filter(
              (coupon) => (coupon.company || "").trim() === company
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
        </ScrollView>

        {/* Status filter, revealed from the header's filter button */}
        {showStatusRow ? (
          <View style={styles.statusTabsRow}>
            {(
              [
                { key: "active", label: "פעילים" },
                { key: "used", label: "נוצלו" },
                { key: "expired", label: "פגי תוקף" },
                { key: "all", label: "הכל" },
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
        <FlatList
          data={filteredCoupons}
          keyExtractor={(item: DecryptedCoupon) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          renderItem={({ item }: { item: DecryptedCoupon }) => (
            <CouponCard
              coupon={item}
              tags={tagsMap[item.id] || []}
              selected={selectedIds.includes(item.id)}
              showSelect={isSelectMode}
              onSelect={() => toggleSelect(item.id)}
              onPress={() => {
                if (isSelectMode) {
                  toggleSelect(item.id);
                } else {
                  router.push(`/coupons/${item.id}`);
                }
              }}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={<Sparkles size={32} color={theme.primary} />}
              title="לא נמצאו קופונים"
              subtitle={
                search || selectedTag
                  ? "נסה לשנות את מילות החיפוש או הסינון"
                  : "הוסף את הקופון הראשון שלך עכשיו!"
              }
              actionTitle="הוסף קופון"
              onAction={() => router.push("/coupons/add")}
            />
          }
        />
      </View>
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
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    gap: 6,
  },
  addBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
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
    gap: 8,
    marginBottom: 14,
  },
  statusTab: {
    flex: 1,
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
    height: 38,
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
    height: 34,
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
    height: 34,
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
});
