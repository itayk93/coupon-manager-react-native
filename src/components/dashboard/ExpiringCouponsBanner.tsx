import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AlertTriangle, ChevronLeft, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { isSpendableCoupon } from "@/lib/couponTotals";
import { couponRouteId } from "@/lib/couponId";

/**
 * A dismissible strip above the wallet card for coupons that expire within
 * EXPIRY_WINDOW_DAYS.
 *
 * Dismissal lasts for the rest of the local calendar day only: the banner
 * comes back the next day with a lower day count, which is the whole point of
 * the reminder. The one exception is escalation — if a coupon drops to
 * URGENT_DAYS or fewer after the user already dismissed today, the banner
 * reappears, because that risk outranks the daily cap.
 */
const EXPIRY_WINDOW_DAYS = 14;
const URGENT_DAYS = 2;
const DISMISS_KEY = "expiring_banner_dismissal";
/** Rows listed when the banner is expanded; the rest stay behind the count. */
const MAX_LISTED = 3;

type Dismissal = { date: string; minDays: number };

/** Calendar date as the device reads it now, not a UTC instant. */
function localToday(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Whole days from today to the expiry date, both read as calendar dates so a
 * coupon expiring tonight reads as 0 rather than a fraction of a day.
 */
function daysUntil(expiration: string): number | null {
  const target = new Date(expiration);
  if (Number.isNaN(target.getTime())) return null;
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000);
}

function daysPhrase(days: number): string {
  if (days <= 0) return "פג היום";
  if (days === 1) return "פג מחר";
  if (days === 2) return "פג בעוד יומיים";
  return `פג בעוד ${days} ימים`;
}

type Tone = { bg: string; border: string; text: string; icon: string };

/** Colour follows the most urgent coupon: the closer the expiry, the louder. */
function toneFor(days: number, theme: ReturnType<typeof useAppTheme>["theme"]): Tone {
  if (days <= 3) {
    return { bg: theme.dangerBg, border: theme.dangerBorder, text: theme.dangerText, icon: theme.danger };
  }
  if (days <= 7) {
    return { bg: theme.warningBg, border: theme.warningBg, text: theme.warningText, icon: theme.warning };
  }
  return { bg: theme.neutralBg, border: theme.cardBorder, text: theme.neutralText, icon: theme.textMuted };
}

type ExpiringCouponsBannerProps = {
  coupons: DecryptedCoupon[];
  isLoading?: boolean;
};

export function ExpiringCouponsBanner({ coupons, isLoading }: ExpiringCouponsBannerProps) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const [dismissal, setDismissal] = useState<Dismissal | null>(null);
  const [dismissalLoaded, setDismissalLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(DISMISS_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            setDismissal(JSON.parse(raw) as Dismissal);
          } catch {
            // A corrupt record just means "never dismissed".
          }
        }
        setDismissalLoaded(true);
      })
      .catch(() => {
        if (active) setDismissalLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const expiring = useMemo(() => {
    return coupons
      .filter(isSpendableCoupon)
      .map((coupon) => ({ coupon, days: coupon.expiration ? daysUntil(coupon.expiration) : null }))
      .filter((entry): entry is { coupon: DecryptedCoupon; days: number } =>
        entry.days !== null && entry.days >= 0 && entry.days <= EXPIRY_WINDOW_DAYS
      )
      .sort((a, b) => a.days - b.days);
  }, [coupons]);

  const handleDismiss = useCallback(() => {
    const record: Dismissal = { date: localToday(), minDays: expiring[0]?.days ?? EXPIRY_WINDOW_DAYS };
    setDismissal(record);
    setExpanded(false);
    AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(record)).catch(() => {
      // Losing the record only costs one extra banner next launch.
    });
  }, [expiring]);

  if (isLoading || !dismissalLoaded || expiring.length === 0) return null;

  const soonest = expiring[0];
  const dismissedToday = dismissal?.date === localToday();
  const escalated = dismissedToday && soonest.days <= URGENT_DAYS && soonest.days < (dismissal?.minDays ?? Infinity);
  if (dismissedToday && !escalated) return null;

  const tone = toneFor(soonest.days, theme);
  const others = expiring.length - 1;
  const headline =
    others > 0
      ? `${soonest.coupon.company} ${daysPhrase(soonest.days)}, ועוד ${others} קופונים פגים בקרוב`
      : `הקופון שלך ב${soonest.coupon.company} ${daysPhrase(soonest.days)}`;

  return (
    <View style={[styles.banner, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <View style={styles.headRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            expiring.length > 1
              ? setExpanded((prev) => !prev)
              : router.push(`/coupons/${couponRouteId(soonest.coupon)}`)
          }
          style={styles.headPressable}
        >
          <AlertTriangle size={19} color={tone.icon} />
          <Text style={[styles.headline, { color: tone.text }]} numberOfLines={2}>
            {headline}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="סגירת ההתראה"
        >
          <X size={18} color={tone.text} />
        </TouchableOpacity>
      </View>

      {expanded
        ? expiring.slice(0, MAX_LISTED).map(({ coupon, days }) => (
            <TouchableOpacity
              key={coupon.id}
              activeOpacity={0.8}
              onPress={() => router.push(`/coupons/${couponRouteId(coupon)}`)}
              style={[styles.itemRow, { borderColor: tone.border }]}
            >
              <ChevronLeft size={16} color={tone.text} />
              <Text style={[styles.itemDays, { color: tone.text }]}>{daysPhrase(days)}</Text>
              <Text style={[styles.itemCompany, { color: theme.text }]} numberOfLines={1}>
                {coupon.company}
              </Text>
            </TouchableOpacity>
          ))
        : null}

      {expanded && expiring.length > MAX_LISTED ? (
        <Text style={[styles.moreText, { color: tone.text }]}>
          ועוד {expiring.length - MAX_LISTED} קופונים
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    ...shadows.card,
  },
  headRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  headPressable: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  headline: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 20,
  },
  itemRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
  },
  itemCompany: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    fontWeight: "700",
    textAlign: "right",
  },
  itemDays: {
    fontFamily: fonts.body,
    fontSize: 12.5,
  },
  moreText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: "right",
    marginTop: 8,
  },
});
