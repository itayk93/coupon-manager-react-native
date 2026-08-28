import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Bell, AlertTriangle, CheckCheck, ChevronLeft, Share2, Trash2, WalletCards } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { EmptyState } from "@/components/ui/EmptyState";
import { CharacterSpotlight } from "@/components/onboarding/CharacterRig";
import { useCoupons } from "@/hooks/useCoupons";
import {
  useHideNotification,
  useInAppNotifications,
  useMarkAllNotificationsViewed,
  useMarkNotificationViewed,
} from "@/hooks/useInAppNotifications";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, shadows } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";
import { notify } from "@/lib/notify";
import { legacyHebrew, mergeNotificationFeeds } from "@/lib/notificationFeed";

type FeedItem = {
  id: string;
  couponId?: number;
  title: string;
  message: string;
  type: "warning" | "system";
  urgent: boolean;
  date: string;
  /** In-app path this notification answers. */
  link?: string | null;
  persistedId?: number;
  kind?: string | null;
};

function iconFor(kind: string | null | undefined, color: string) {
  if (kind === "share_received") return <Share2 size={18} color={color} />;
  if (kind === "idle_money" || kind === "balance_updated") return <WalletCards size={18} color={color} />;
  return <Bell size={18} color={color} />;
}

export function NotificationsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data: coupons = [], refetch, isRefetching } = useCoupons();
  const { data: inAppRows = [] } = useInAppNotifications();
  const markViewed = useMarkNotificationViewed();
  const markAllViewed = useMarkAllNotificationsViewed();
  const hideNotification = useHideNotification();

  const expiringItems: FeedItem[] = coupons
    .filter((c) => {
      if (!c.expiration) return false;
      const days = (new Date(c.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 14 && c.status !== "נוצל";
    })
    .map((c) => {
      const days = Math.ceil(
        (new Date(c.expiration!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: `exp-${c.id}`,
        couponId: c.id,
        title: `הקופון של ${c.company} עומד לפוג!`,
        message: `נותרו ${days} ימים למימוש יתרה של ${formatIls((c.value || 0) - (c.used_value || 0))}`,
        type: "warning",
        urgent: days <= 3,
        date: days <= 3 ? "היום" : `בעוד ${days} ימים`,
      };
    });

  const persistedItems: FeedItem[] = (inAppRows || [])
    // Expiry is generated live from current coupon data below. Old stored rows
    // would otherwise repeat the same warning with stale day counts.
    .filter((row) => row.type !== "expiry")
    .map((row) => ({
    id: `db-${row.id}`,
    // Rows written before notifications had kinds carry no title of their own.
    title: legacyHebrew(row.title || "עדכון בארנק"),
    message: legacyHebrew(row.message),
    type: "system",
    urgent: !row.viewed,
    date: row.timestamp ? new Date(row.timestamp).toLocaleDateString("he-IL") : "",
    link: row.link || null,
    persistedId: row.id,
    kind: row.type,
  }));

  const notifications = mergeNotificationFeeds<FeedItem>([expiringItems, persistedItems]);

  const actionRequired = notifications.filter((n) => n.type === "warning" || n.kind === "idle_money");
  const updates = notifications.filter((n) => !actionRequired.includes(n) && n.urgent);
  const history = notifications.filter((n) => !actionRequired.includes(n) && !n.urgent);

  const unreadIds = notifications
    .filter((n) => n.urgent && n.persistedId)
    .map((n) => n.persistedId!);

  const markAllRead = () => {
    markAllViewed.mutate(undefined, {
      onSuccess: () => notify.success("כל ההתראות סומנו כנקראו"),
      onError: () => notify.error("לא הצלחנו לסמן את ההתראות"),
    });
  };

  const hideItem = (item: FeedItem) => {
    if (!item.persistedId) return;
    hideNotification.mutate(item.persistedId, {
      onSuccess: () => notify.success("ההתראה הוסרה", item.title),
      onError: () => notify.error("לא הצלחנו להסיר את ההתראה"),
    });
  };

  const renderRow = (item: FeedItem, unread: boolean) => {
    const row = (
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => {
          if (item.persistedId && unread) markViewed.mutate(item.persistedId);
          if (item.couponId) router.push(`/coupons/${item.couponId}`);
          // Each kind points at the screen that answers it: savings at the chart,
          // a share at the sharing list, an expiry at the coupons.
          else if (item.link) router.push(item.link as any);
        }}
        style={[styles.row, { borderBottomColor: theme.divider }]}
      >
        {/* The accent belongs to what should be tapped, so an unread row gets a
            thin bar on its leading edge rather than a full colour wash. */}
        <View
          style={[
            styles.unreadBar,
            { backgroundColor: unread ? theme.primary : "transparent" },
          ]}
        />

        <View style={styles.iconSlot}>
          {item.type === "warning" ? (
            <AlertTriangle size={18} color={theme.warning} />
          ) : iconFor(item.kind, theme.primary)}
        </View>

        <View style={styles.contentCol}>
          <View style={styles.titleLine}>
            <Text
              numberOfLines={1}
              style={[
                styles.title,
                { color: unread ? theme.text : theme.textSecondary, fontWeight: unread ? "700" : "500" },
              ]}
            >
              {item.title}
            </Text>
            {item.date ? (
              <Text style={[styles.date, { color: theme.textSubtle }]}>{item.date}</Text>
            ) : null}
          </View>
          <Text style={[styles.message, { color: theme.textMuted }]}>{item.message}</Text>
        </View>

        {item.persistedId ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`הסרת ההתראה: ${item.title}`}
            hitSlop={4}
            onPress={(event) => {
              event.stopPropagation();
              hideItem(item);
            }}
            disabled={hideNotification.isPending}
            style={styles.removeButton}
          >
            <Trash2 size={17} color={theme.textSubtle} />
          </TouchableOpacity>
        ) : item.couponId || item.link ? (
          <ChevronLeft size={16} color={theme.textSubtle} style={styles.chevron} />
        ) : null}
      </TouchableOpacity>
    );

    // Only stored rows can be hidden; live expiry warnings would come straight
    // back on the next render, so they carry no swipe action.
    if (!item.persistedId) return <View key={item.id}>{row}</View>;

    return (
      <Swipeable
        key={item.id}
        friction={2}
        rightThreshold={40}
        renderRightActions={() => (
          <TouchableOpacity
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={() => hideItem(item)}
            style={[styles.swipeAction, { backgroundColor: theme.danger }]}
          >
            <Trash2 size={18} color="#fff" />
          </TouchableOpacity>
        )}
      >
        {row}
      </Swipeable>
    );
  };

  const renderSection = (label: string, items: FeedItem[], unread: boolean, showCharacter = false) =>
    items.length > 0 ? (
      <>
        {showCharacter ? (
          <View style={styles.actionCharacter}>
            <CharacterSpotlight character="investigator" state="thinking" size="small" />
          </View>
        ) : null}
        <Text style={[styles.groupLabel, { color: theme.textSubtle }]}>
          {label} · {items.length}
        </Text>
        <View style={[styles.group, { backgroundColor: theme.card }]}>
          {items.map((item) => renderRow(item, unread))}
        </View>
      </>
    ) : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header
        title="מרכז התראות"
        showBack
        onBack={() => router.back()}
        rightAction={
          unreadIds.length > 0 ? (
            <TouchableOpacity
              onPress={markAllRead}
              disabled={markAllViewed.isPending}
              accessibilityRole="button"
              accessibilityLabel="סימון כל ההתראות כנקראו"
              activeOpacity={0.85}
              style={[styles.markAllButton, { backgroundColor: theme.primary }]}
            >
              <CheckCheck size={15} color="#fff" />
              <Text style={styles.markAllText}>סמן הכל כנקרא</Text>
            </TouchableOpacity>
          ) : undefined
        }
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
          />
        }
      >
        {notifications.length > 0 ? (
          <>
            {renderSection("דורש פעולה", actionRequired, true, true)}
            {renderSection("עדכונים", updates, true)}
            {renderSection("היסטוריה", history, false)}
          </>
        ) : (
          <EmptyState
            icon={<Bell size={32} color={theme.primary} />}
            title="אין התראות חדשות"
            subtitle="כל הקופונים שלך מעודכנים ובטוחים. נעדכן אותך כשיתקרב תאריך תפוגה!"
          />
        )}
      </ScrollView>
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
    paddingTop: 10,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  group: {
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 18,
    ...shadows.card,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  unreadBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 3,
  },
  iconSlot: {
    width: 22,
    alignItems: "center",
    paddingTop: 1,
  },
  contentCol: {
    flex: 1,
    alignItems: "flex-end",
  },
  titleLine: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    alignSelf: "stretch",
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "right",
    marginTop: 2,
  },
  date: {
    fontSize: 11,
  },
  chevron: {
    alignSelf: "center",
  },
  removeButton: {
    width: 44,
    height: 44,
    marginVertical: -12,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  actionCharacter: {
    alignItems: "flex-end",
    marginBottom: -6,
  },
  groupLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textAlign: "right",
    marginBottom: 6,
    marginTop: 4,
  },
  swipeAction: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  markAllButton: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  markAllText: {
    color: "#fff",
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    fontWeight: "700",
  },
});
