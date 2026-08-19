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
import { useRouter } from "expo-router";
import { Bell, AlertTriangle } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCoupons } from "@/hooks/useCoupons";
import { useInAppNotifications } from "@/hooks/useInAppNotifications";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";

type FeedItem = {
  id: string;
  couponId?: number;
  title: string;
  message: string;
  type: "warning" | "system";
  urgent: boolean;
  date: string;
};

export function NotificationsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading, refetch, isRefetching } = useCoupons();
  const { data: inAppRows = [] } = useInAppNotifications();

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
        message: `נותרו עוד ${days} ימים למימוש יתרה של ${(
          (c.value || 0) - (c.used_value || 0)
        ).toFixed(2)} ₪`,
        type: "warning",
        urgent: days <= 3,
        date: days <= 3 ? "היום" : `בעוד ${days} ימים`,
      };
    });

  const persistedItems: FeedItem[] = (inAppRows || []).map((row) => ({
    id: `db-${row.id}`,
    title: "התראה",
    message: row.message,
    type: "system",
    urgent: !row.viewed,
    date: row.timestamp ? new Date(row.timestamp).toLocaleDateString("he-IL") : "",
  }));

  const notifications = [...persistedItems, ...expiringItems];

  const today = notifications.filter((n) => n.urgent);
  const earlier = notifications.filter((n) => !n.urgent);

  const renderNotification = (item: FeedItem, unread: boolean) => (
    <TouchableOpacity
      key={item.id}
      activeOpacity={0.8}
      onPress={() =>
        item.couponId ? router.push(`/coupons/${item.couponId}`) : router.push("/notifications")
      }
      style={[
        styles.notifCard,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          opacity: unread ? 1 : 0.75,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: item.type === "warning" ? theme.warningBg : theme.primaryTint },
        ]}
      >
        {item.type === "warning" ? (
          <AlertTriangle size={18} color={theme.warning} />
        ) : (
          <Bell size={18} color={theme.primary} />
        )}
      </View>

      <View style={styles.contentCol}>
        <Text style={[styles.notifTitle, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.notifMessage, { color: theme.textMuted }]}>{item.message}</Text>
        <Text style={[styles.notifDate, { color: theme.textSubtle }]}>{item.date}</Text>
      </View>

      {unread ? <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} /> : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="מרכז התראות" showBack onBack={() => router.back()} />

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
            {today.length > 0 ? (
              <>
                <Text style={[styles.groupLabel, { color: theme.textSubtle }]}>היום</Text>
                {today.map((item) => renderNotification(item, true))}
              </>
            ) : null}

            {earlier.length > 0 ? (
              <>
                <Text style={[styles.groupLabel, { color: theme.textSubtle }]}>מוקדם יותר</Text>
                {earlier.map((item) => renderNotification(item, false))}
              </>
            ) : null}
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
  notifCard: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
    ...shadows.card,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  contentCol: {
    flex: 1,
    alignItems: "flex-end",
  },
  notifTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  notifMessage: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "right",
    marginBottom: 6,
  },
  notifDate: {
    fontSize: 12,
  },
  groupLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 8,
    marginTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
});
