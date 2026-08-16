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
import { Header } from "@/components/ui/Header";
import { CouponCard } from "@/components/coupons/CouponCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCoupons, useBulkDeleteCoupons, DecryptedCoupon } from "@/hooks/useCoupons";
import { useCouponTagsMap } from "@/hooks/useTags";
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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

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
  }, [coupons, search, selectedTag, statusFilter, tagsMap]);

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((item) => item !== id);
      setSelectedIds(next);
      if (next.length === 0) setIsSelectMode(false);
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

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
      <Header
        title="הקופונים שלי"
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => triggerAutoUpdate.mutate(undefined)}
              disabled={triggerAutoUpdate.isPending}
              style={[
                styles.iconBtn,
                { backgroundColor: theme.surfaceAlt },
              ]}
            >
              <RefreshCw
                size={18}
                color={theme.text}
                style={triggerAutoUpdate.isPending ? { opacity: 0.5 } : {}}
              />
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
              <Plus size={18} color="#ffffff" />
              <Text style={styles.addBtnText}>חדש</Text>
            </TouchableOpacity>
          </View>
        }
      />

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
            placeholder="חיפוש לפי חברה, תיאור או קוד..."
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        {/* Status Filter Tabs */}
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

        {/* Tag Filter Chips (if tags exist) */}
        {allTags.length > 0 ? (
          <FlatList
            data={allTags}
            horizontal
            inverted
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item: string) => item}
            style={styles.tagsSlider}
            contentContainerStyle={styles.tagsContent}
            renderItem={({ item }: { item: string }) => {
              const isSelected = selectedTag === item;
              return (
                <TouchableOpacity
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
                    style={[
                      styles.tagChipText,
                      { color: isSelected ? "#ffffff" : theme.label },
                    ]}
                  >
                    #{item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
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
    flexDirection: "row-reverse",
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
  tagsSlider: {
    marginBottom: 10,
  },
  tagsContent: {
    gap: 6,
    paddingHorizontal: 2,
  },
  tagChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "700",
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
