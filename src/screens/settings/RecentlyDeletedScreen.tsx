import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { RotateCcw, Trash2, Sparkles } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  useDeletedCoupons,
  useRestoreCoupons,
  usePermanentDeleteCoupons,
  TRASH_RETENTION_DAYS,
  type DecryptedCoupon,
} from "@/hooks/useCoupons";
import { useAppTheme } from "@/contexts/ThemeContext";
import { notify } from "@/lib/notify";
import { fonts, radii } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";
import { couponRemainingValue } from "@/lib/couponTotals";

const DAY_MS = 1000 * 60 * 60 * 24;

function daysLeftInTrash(deletedAt: string | null | undefined): number {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / DAY_MS;
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsed));
}

export function RecentlyDeletedScreen() {
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading } = useDeletedCoupons();
  const restore = useRestoreCoupons();
  const purge = usePermanentDeleteCoupons();

  const handleRestore = (coupon: DecryptedCoupon) => {
    restore.mutate([coupon.id], {
      onSuccess: () => notify.success("הקופון חזר לארנק", `${coupon.company} שוב פעיל.`),
    });
  };

  const handlePurge = (coupon: DecryptedCoupon) => {
    notify.confirm(
      "למחוק לצמיתות?",
      `הקופון של ${coupon.company} יימחק לגמרי ולא ניתן יהיה לשחזר אותו.`,
      () => purge.mutate([coupon.id]),
      "מחיקה לצמיתות",
    );
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Header title="נמחקו לאחרונה" />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : coupons.length === 0 ? (
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState
            icon={<Sparkles size={28} color={theme.primary} />}
            title="הפח ריק ✨"
            subtitle={`קופונים שתמחקו יופיעו כאן ${TRASH_RETENTION_DAYS} ימים, ואפשר יהיה לשחזר אותם עד שהם נמחקים סופית.`}
          />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            קופון שנמחק נשמר כאן {TRASH_RETENTION_DAYS} ימים ואז נמחק לצמיתות.
          </Text>

          {coupons.map((coupon) => {
            const left = daysLeftInTrash(coupon.deleted_at);
            const remaining = couponRemainingValue(coupon);
            return (
              <View
                key={coupon.id}
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <View style={styles.cardHead}>
                  <Text style={[styles.company, { color: theme.text }]} numberOfLines={1}>
                    {coupon.company}
                  </Text>
                  <Text style={[styles.value, { color: theme.textMuted }]}>
                    {formatIls(remaining)}
                  </Text>
                </View>

                <Text style={[styles.timeLeft, { color: left <= 3 ? theme.danger : theme.textMuted }]}>
                  {left === 0 ? "נמחק בקרוב" : `עוד ${left} ימים עד מחיקה סופית`}
                </Text>

                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={() => handleRestore(coupon)}
                    disabled={restore.isPending}
                    style={[styles.btn, { backgroundColor: theme.primary }]}
                  >
                    <RotateCcw size={16} color="#ffffff" />
                    <Text style={[styles.btnText, { color: "#ffffff" }]}>שחזור</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handlePurge(coupon)}
                    disabled={purge.isPending}
                    style={[styles.btn, { backgroundColor: theme.surfaceAlt }]}
                  >
                    <Trash2 size={16} color={theme.danger} />
                    <Text style={[styles.btnText, { color: theme.danger }]}>מחיקה לצמיתות</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  note: { fontSize: 13, textAlign: "right", lineHeight: 19 },
  card: { borderRadius: radii.lg, borderWidth: 1, padding: 14, gap: 8 },
  cardHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  company: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", flex: 1, textAlign: "right" },
  value: { fontSize: 14, fontWeight: "600", marginRight: 8 },
  timeLeft: { fontSize: 12, textAlign: "right" },
  actions: { flexDirection: "row-reverse", gap: 10, marginTop: 4 },
  btn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radii.md,
  },
  btnText: { fontSize: 13, fontWeight: "700" },
});
