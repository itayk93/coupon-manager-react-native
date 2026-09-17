import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, type LayoutChangeEvent } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronLeft, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { isSpendableCoupon } from "@/lib/couponTotals";
import { couponRouteId } from "@/lib/couponId";
import { EXPIRY_PERFORMANCE, daysPhrase, expiryEmphasis, expiryLevel } from "@/lib/expiryUrgency";
import { fitFontSize } from "@/lib/fitText";
import { ExpiryGlow } from "@/components/dashboard/ExpiryGlow";
import { Kuponi } from "@/components/ui/Kuponi";

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
/** Shared by the stylesheet and by the headline's width arithmetic. */
const BANNER_PADDING = 12;
const MASCOT_SLOT = 73;
const CLOSE_SLOT = 44;
/** The gaps `headRow` puts between the slots and the headline. */
const ROW_GAP = 10;
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
  /**
   * Reports whether this banner is actually on screen. Whether it shows
   * depends on stored dismissal state that only this component reads, so the
   * dashboard cannot work it out on its own — and it needs to know, because
   * the push nudge below waits its turn rather than stacking underneath.
   */
  onVisibilityChange?: (visible: boolean) => void;
};

export function ExpiringCouponsBanner({
  coupons,
  isLoading,
  onVisibilityChange,
}: ExpiringCouponsBannerProps) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const [dismissal, setDismissal] = useState<Dismissal | null>(null);
  const [dismissalLoaded, setDismissalLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Room the headline has, measured on its flex container. The container is
  // `flex: 1` between two fixed slots, so its width does not depend on the
  // text inside it — measuring the Text itself instead feeds the shrink back
  // into the measurement and walks every headline down to the floor size.
  const [headlineWidth, setHeadlineWidth] = useState(0);

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

  const soonest = expiring[0];
  const dismissedToday = dismissal?.date === localToday();
  const escalated =
    dismissedToday &&
    soonest !== undefined &&
    soonest.days <= URGENT_DAYS &&
    soonest.days < (dismissal?.minDays ?? Infinity);
  // Worked out before the early return so the hook below it always runs.
  const visible =
    !isLoading &&
    dismissalLoaded &&
    expiring.length > 0 &&
    !(dismissedToday && !escalated);

  useEffect(() => {
    onVisibilityChange?.(visible);
    // Dismissing the banner, or navigating away from it, has to put the
    // dashboard back to believing nothing is here.
    return () => onVisibilityChange?.(false);
  }, [visible, onVisibilityChange]);

  if (!visible) return null;

  const tone = toneFor(soonest.days, theme);
  const others = expiring.length - 1;
  const headline =
    others > 0
      ? `${soonest.coupon.company} ${daysPhrase(soonest.days)}, ועוד ${others} קופונים פגים בקרוב`
      : `הקופון שלך ב${soonest.coupon.company} ${daysPhrase(soonest.days)}`;

  // How loud the banner is allowed to be. See `expiryUrgency.ts`: still above
  // three days, one pass at two or three, a slow breath inside 48 hours.
  const emphasis = expiryEmphasis(soonest.days);
  // The face and the motion come from the same step of the same ladder.
  const kuponi = EXPIRY_PERFORMANCE[expiryLevel(soonest.days)];
  const headlineFontSize = fitFontSize(headline.length, headlineWidth);

  return (
    <View
      style={[styles.banner, { backgroundColor: tone.bg, borderColor: tone.border }]}
    >
      <ExpiryGlow emphasis={emphasis} color={tone.icon} radius={radii.lg} />

      {/* The mascot leans in over the bottom edge rather than sitting inside
          the row. Inside, it set the banner's height — 46pt of character plus
          padding for one line of text — and it floated, because the rig anchors
          a character to the bottom of a slot that is invisible here. Clipped by
          the banner's own overflow it has a ground to stand on, and it costs
          the strip no height at all. */}
      <View style={styles.mascot} pointerEvents="none">
        <Kuponi
          state={kuponi.state}
          speed={kuponi.speed}
          size="small"
        />
      </View>
      {/* Equal slots at both ends, and the line centred between them.
          The mascot is absolutely positioned and overhangs the strip, so it
          carries far more visual weight than a thin X on the other side. An
          empty slot the mascot's width on the right, and the X centred in a
          slot the same width on the left, give the line a middle to sit in —
          the layout's middle rather than the container's. */}
      <View style={styles.headRow}>
        <View style={styles.mascotSlot} pointerEvents="none" />
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            expiring.length > 1
              ? setExpanded((prev) => !prev)
              : router.push(`/coupons/${couponRouteId(soonest.coupon)}`)
          }
          style={styles.headPressable}
          onLayout={(event: LayoutChangeEvent) =>
            setHeadlineWidth(event.nativeEvent.layout.width)
          }
        >
          {/* One line, always. The strip is a glance, not a paragraph: a
              second line doubles its height and pushes the wallet card down
              the screen.

              The size is computed rather than left to `adjustsFontSizeToFit`,
              which react-native-web does not implement and Android honours
              unevenly — on those devices a long headline came out cut off with
              an ellipsis, losing the coupon's own name. */}
          <Text
            style={[
              styles.headline,
              { color: tone.text, fontSize: headlineFontSize, lineHeight: headlineFontSize + 5 },
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
          >
            {headline}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="סגירת ההתראה"
          style={styles.closeSlot}
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

      {/* Was a dead end: a line of text saying more coupons exist, with
          nowhere to go and see them. */}
      {expanded ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/at-risk")}
          accessibilityRole="button"
          style={styles.moreRow}
        >
          <ChevronLeft size={15} color={tone.text} />
          <Text style={[styles.moreText, { color: tone.text }]}>
            {expiring.length > MAX_LISTED
              ? `ועוד ${expiring.length - MAX_LISTED} קופונים — לראות הכול`
              : "לראות הכול, עם הסכומים"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    // Compact on purpose. Carbon and PatternFly both treat an inline alert as
    // one line of text with an icon; at 72pt this strip was taking 8% of the
    // screen to say nine words, and the shadow made it read as a card rather
    // than a notice.
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    paddingHorizontal: BANNER_PADDING,
    paddingVertical: 9,
    marginBottom: 12,
  },
  mascot: {
    position: "absolute",
    right: 4,
    // Pushed past the bottom edge so the banner crops it: only the head and
    // shoulders clear the rim, and the strip keeps the height of its text.
    bottom: -28,
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "flex-end",
    transform: [{ scale: 64 / 88 }],
  },
  headRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: ROW_GAP,
  },
  headPressable: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  /**
   * The two ends reserve different widths on purpose.
   *
   * Equal slots do not produce equal gaps here, because the mascot is
   * absolutely positioned and overhangs its own box: its footprint is 68pt
   * (64 wide at `right: 4`) against the X's 18pt of ink. With both ends at 52
   * the centred line sat 26pt from the mascot and 38pt from the X — visibly
   * pushed toward the heavy side.
   *
   * The right slot is widened by that difference instead, which moves the
   * line's centre halfway back and leaves an even gap on each side. Change
   * the mascot's width or offset and these two numbers have to be re-measured
   * together.
   */
  mascotSlot: {
    width: MASCOT_SLOT,
    alignItems: "center",
    justifyContent: "center",
  },
  closeSlot: {
    width: CLOSE_SLOT,
    // Flush to the outer edge, where a dismiss control belongs and where this
    // one has always been. The slot still reserves its width for the layout;
    // only the glyph sits at the end of it.
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headline: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
    // Optical centring, not geometric: the line box is already dead centre in
    // the strip, but Hebrew has no descenders, so the ink sits in the upper
    // part of a box that reserves room for a `g` that never comes. The eye
    // reads the ink. One point down puts the letters where the middle looks.
    marginTop: 1,
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
  moreRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 5, paddingTop: 6 },
  moreText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: "right",
    marginTop: 8,
  },
});
