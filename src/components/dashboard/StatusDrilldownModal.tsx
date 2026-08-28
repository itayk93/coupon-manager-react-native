import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Modal } from "@/components/ui/Modal";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { couponRemainingValue } from "@/lib/couponTotals";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";
import { CouponCard } from "@/components/coupons/CouponCard";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";

export type CouponStatusFilter = "active" | "used" | "expired";

type StatusDrilldownModalProps = {
  visible: boolean;
  onClose: () => void;
  filter: CouponStatusFilter | null;
  coupons: DecryptedCoupon[];
};

const STATUS_TITLES: Record<CouponStatusFilter, string> = {
  active: "קופונים פעילים",
  used: "נוצלו במלואם",
  expired: "פגי תוקף",
};

const STATUS_DESCRIPTIONS: Record<CouponStatusFilter, string> = {
  active: "קופונים שעדיין בתוקף ויש בהם יתרה שניתן לממש בחנויות ובאתרים.",
  used: "קופונים שניצלת את מלוא הסכום שלהם עד תום.",
  expired: "קופונים שעבר תאריך התוקף שלהם לפני שנוצלו במלואם.",
};

export function filterCouponsByStatus(
  coupons: DecryptedCoupon[],
  filter: CouponStatusFilter
): DecryptedCoupon[] {
  const now = Date.now();

  return coupons.filter((coupon) => {
    const remaining = (coupon.value || 0) - (coupon.used_value || 0);
    const isUsed = coupon.status === "נוצל" || remaining <= 0;
    const isExpired =
      coupon.expiration && new Date(coupon.expiration).getTime() < now;

    if (filter === "used") return isUsed;
    if (filter === "expired") return !isUsed && isExpired;
    return !isUsed && !isExpired;
  });
}

export function StatusDrilldownModal({
  visible,
  onClose,
  filter,
  coupons,
}: StatusDrilldownModalProps) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const [usageCoupon, setUsageCoupon] = useState<DecryptedCoupon | null>(null);

  const filtered = useMemo(
    () => (filter ? filterCouponsByStatus(coupons, filter) : []),
    [coupons, filter]
  );

  const total = useMemo(
    () =>
      filtered.reduce(
        (sum, coupon) => sum + Math.max(0, couponRemainingValue(coupon)),
        0
      ),
    [filtered]
  );

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={filter ? STATUS_TITLES[filter] : "פירוט קופונים"}
      subtitle={`${filtered.length} קופונים`}
    >
      <View style={styles.container}>
        {filter && STATUS_DESCRIPTIONS[filter] ? (
          <View
            style={[
              styles.explainerBox,
              { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.explainerText, { color: theme.textSubtle }]}>
              {STATUS_DESCRIPTIONS[filter]}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.totalBox,
            { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.totalLabel, { color: theme.textMuted }]}>יתרה כוללת</Text>
          <Text
            style={[styles.totalValue, { color: theme.primary }]}
            maxFontSizeMultiplier={1.3}
          >
            {formatIls(total)}
          </Text>
        </View>

        {filtered.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            אין קופונים בקטגוריה זו.
          </Text>
        ) : (
          filtered.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              onPress={() => {
                onClose();
                router.push(`/coupons/${coupon.id}`);
              }}
              onReportUsage={() => setUsageCoupon(coupon)}
            />
          ))
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  explainerBox: {
    borderRadius: radii.card,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  explainerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "right",
  },
  totalBox: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 16,
    alignItems: "flex-end",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  totalValue: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "900",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    marginVertical: 16,
  },
});
