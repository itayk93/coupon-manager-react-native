import { useNativeDriver } from "@/lib/animation";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { getCompanyColor, getCompanyLogoSource, getContrastText } from "@/lib/companyLogos";
import { ShimmerLogo } from "@/components/coupons/ShimmerLogo";
import { useHoldAction } from "@/hooks/useHoldAction";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";
import { couponRouteId } from "@/lib/couponId";


type CouponCardProps = {
  coupon: DecryptedCoupon;
  tags?: string[];
  onPress: () => void;
  onReportUsage?: () => void;
  onEdit?: () => void;
  selected?: boolean;
  onSelect?: () => void;
  showSelect?: boolean;
};

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

import { formatIls } from "@/lib/formatIls";

function formatDateShort(dateStr: string | null) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function daysUntil(expiration: string | null) {
  if (!expiration) return null;
  const ms = new Date(expiration).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * Coupon card from the redesign: a brand-coloured header with the company logo
 * overlapping its lower edge, then balance, usage bar, code and two actions.
 */
export function CouponCard({
  coupon,
  tags = [],
  onPress,
  onReportUsage,
  onEdit,
  selected = false,
  onSelect,
  showSelect = false,
}: CouponCardProps) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [copied, setCopied] = React.useState(false);
  const logoUri = getCompanyLogoSource(coupon.company);

  const total = coupon.value || 0;
  const used = coupon.used_value || 0;
  const remaining = Math.max(0, total - used);
  const usedPct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  const days = daysUntil(coupon.expiration);
  const isFullyUsed = coupon.status === "נוצל" || remaining <= 0;
  const isExpired = days !== null && days < 0;
  const isExpiringSoon = days !== null && days >= 0 && days <= 14;

  const brand = getCompanyColor(coupon.company || "");
  const headerColor = isFullyUsed || isExpired ? theme.textSubtle : brand;
  const headerText = getContrastText(headerColor);
  const headerPill = headerText === "#ffffff" ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)";

  const statusLabel = isExpired
    ? "פג תוקף"
    : isFullyUsed
      ? "נוצל"
      : isExpiringSoon
        ? "עומד לפוג"
        : "פעיל";

  const formattedExpiry = formatDateShort(coupon.expiration);
  const daysLabel = isExpired
    ? "פג תוקף"
    : isFullyUsed
      ? "נוצל במלואו"
      : isExpiringSoon
        ? `נותרו ${days} ימים`
        : formattedExpiry
          ? `בתוקף עד: ${formattedExpiry}`
          : "ללא תוקף";

  // Green by default, by product decision. A coupon that is spent or out of
  // date still keeps its red, since that is the one case worth interrupting on.
  const daysColor = isExpired || isFullyUsed ? theme.danger : theme.success;

  const handleCopy = async (e: any) => {
    e?.stopPropagation?.();
    if (!coupon.code) return;
    await Clipboard.setStringAsync(coupon.code);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isInactive = isFullyUsed || isExpired;

  // Holding anywhere on the card is a shortcut into reporting a usage; a
  // plain tap still opens the coupon.
  const reportUsage = React.useCallback(() => {
    if (onReportUsage) {
      onReportUsage();
    } else {
      onPress();
    }
  }, [onReportUsage, onPress]);

  const hold = useHoldAction({ onHold: reportUsage, enabled: !isInactive && !showSelect });

  const handleCardPress = () => {
    // The hold already opened the usage flow — don't also navigate.
    if (hold.consumeHold()) return;
    if (showSelect) {
      onSelect?.();
    } else {
      onPress();
    }
  };

  const holdFill = hold.progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  // "Crumple" easter egg: a spent/expired coupon tilts and gets a stamp
  // slapped on it. The stamp lands with a haptic thud, but only when the
  // coupon turns inactive while the card is on screen (i.e. right after the
  // user reports the usage) — never for a whole list on first render.
  const stamp = React.useRef(new Animated.Value(isInactive ? 1 : 0)).current;
  const wasInactive = React.useRef(isInactive);

  React.useEffect(() => {
    if (isInactive === wasInactive.current) return;
    wasInactive.current = isInactive;

    if (!isInactive) {
      stamp.setValue(0);
      return;
    }

    stamp.setValue(0);
    Animated.timing(stamp, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.back(2)),
      useNativeDriver,
    }).start(({ finished }) => {
      if (finished && Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }
    });
  }, [isInactive, stamp]);

  const stampStyle = {
    opacity: stamp,
    transform: [
      { rotate: "-12deg" },
      {
        scale: stamp.interpolate({
          inputRange: [0, 1],
          outputRange: [2.4, 1],
        }),
      },
    ],
  };

  const cardTilt = stamp.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-1.2deg"],
  });

  const handleSecondaryAction = (e: any) => {
    e?.stopPropagation?.();
    if (isInactive) {
      if (onEdit) {
        onEdit();
      } else {
        router.push({
          pathname: "/coupons/edit",
          params: { couponId: couponRouteId(coupon) },
        });
      }
    } else {
      if (onReportUsage) {
        onReportUsage();
      } else {
        onPress();
      }
    }
  };

  return (
    <AnimatedTouchable
      activeOpacity={0.88}
      onPress={handleCardPress}
      onPressIn={hold.handlers.onPressIn}
      onPressOut={hold.handlers.onPressOut}
      style={[
        styles.card,
        shadows.card,
        {
          backgroundColor: theme.card,
          borderColor: selected ? theme.primary : "transparent",
          borderWidth: selected ? 2 : 0,
          opacity: isFullyUsed || isExpired ? 0.75 : 1,
          transform: [{ rotate: cardTilt }],
        },
      ]}
    >
      {isInactive ? (
        <Animated.View style={[styles.stamp, stampStyle, { pointerEvents: "none" }]}>
          <Text style={[styles.stampText, { color: theme.danger }]}>
            {isExpired ? "פג תוקף" : "נוצל"}
          </Text>
        </Animated.View>
      ) : null}
      {/* Brand header */}
      <View style={[styles.header, { backgroundColor: headerColor }]}>
        <ShimmerLogo
          source={logoUri}
          size={56}
          style={[styles.logoFrame, { backgroundColor: theme.card }]}
          imageStyle={styles.logoImg}
        />

        <View style={styles.headerTitleGroup}>
          <Text numberOfLines={1} style={[styles.company, { color: headerText }]}>
            {coupon.company || "ללא חברה"}
          </Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: headerPill }]}>
          <Text style={[styles.statusPillText, { color: headerText }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Hold progress: fills across the card on the way to "report usage" */}
      <Animated.View
        style={[styles.holdBar, { width: holdFill, backgroundColor: theme.primary, pointerEvents: "none" }]}
      />

      {/* Body */}
      <Animated.View style={styles.body}>
        <View>
          <View style={styles.amountRow}>
            <Text style={[styles.remaining, { color: theme.text }]}>
              {formatIls(remaining)}
            </Text>
            <Text style={[styles.ofTotal, { color: theme.textSubtle }]}>
              מתוך {formatIls(total)}
            </Text>
          </View>

          <View style={[styles.track, { backgroundColor: theme.track }]}>
            <View
              style={[styles.fill, { width: `${usedPct}%`, backgroundColor: headerColor }]}
            />
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={[styles.code, { color: theme.label }]}>
            {coupon.code || "—"}
          </Text>
          <Text style={[styles.days, { color: daysColor }]}>{daysLabel}</Text>
        </View>

        {coupon.card_exp || coupon.cvv ? (
          <View style={[styles.cardDetailsRow, { borderTopColor: theme.divider }]}>
            {coupon.card_exp ? (
              <View style={styles.cardDetailItem}>
                <Text style={[styles.cardDetailLabel, { color: theme.textMuted }]}>
                  תוקף כרטיס:
                </Text>
                <Text style={[styles.cardDetailVal, { color: theme.text }]} selectable>
                  {coupon.card_exp}
                </Text>
              </View>
            ) : null}

            {coupon.card_exp && coupon.cvv ? (
              <View style={[styles.cardDetailDivider, { backgroundColor: theme.divider }]} />
            ) : null}

            {coupon.cvv ? (
              <View style={styles.cardDetailItem}>
                <Text style={[styles.cardDetailLabel, { color: theme.textMuted }]}>
                  {"‪CVV:‬"}
                </Text>
                <Text style={[styles.cardDetailVal, { color: theme.text }]} selectable>
                  {coupon.cvv}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {tags.slice(0, 3).map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: theme.primaryTint }]}>
                <Text style={[styles.tagText, { color: theme.primaryDark }]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          {/* Copying the code is the moment the coupon is actually used, so it
              carries the brand fill. Reporting usage comes afterwards and sits
              quiet, which keeps one filled button per card. */}
          <TouchableOpacity
            onPress={handleCopy}
            style={[styles.actionBtn, { backgroundColor: headerColor }]}
          >
            {copied ? (
              <Check size={14} color={headerText} />
            ) : null}
            <Text style={[styles.actionText, { color: headerText }]}>
              {copied ? "הועתק" : "העתקת קוד"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSecondaryAction}
            style={[
              styles.actionBtn,
              styles.actionBtnQuiet,
              { borderColor: theme.inputBorder },
            ]}
          >
            <Text style={[styles.actionText, { color: theme.label }]}>
              {isInactive ? "עריכת קופון" : "דיווח שימוש"}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.sheet,
    overflow: "hidden",
    marginBottom: 20,
  },
  header: {
    height: 76,
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: "flex-end",
  },
  company: {
    fontFamily: fonts.display,
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  statusPill: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusPillText: {
    fontFamily: fonts.bodyBold,
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  logoFrame: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.lifted,
  },
  logoImg: {
    width: "74%",
    height: "74%",
  },
  holdBar: {
    position: "absolute",
    top: 0,
    right: 0,
    height: 4,
    zIndex: 6,
  },
  body: {
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 14,
  },
  amountRow: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  remaining: {
    fontFamily: fonts.display,
    // The balance is what the card is opened for, so it reads before anything
    // else is parsed: roughly triple the label beside it.
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  ofTotal: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  track: {
    height: 6,
    borderRadius: radii.pill,
    overflow: "hidden",
    flexDirection: "row-reverse",
  },
  fill: {
    height: "100%",
    borderRadius: radii.pill,
  },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  cardDetailsRow: {
    // A grey pill here made a third box inside an already layered card, so the
    // details sit on the card itself, separated by a rule.
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
  },
  cardDetailItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  cardDetailLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  cardDetailVal: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    writingDirection: "ltr",
  },
  cardDetailDivider: {
    width: 1,
    height: 14,
  },
  code: {
    fontFamily: fonts.display,
    // Readable at arm's length without competing with the balance, which is
    // the one number the card leads on.
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    writingDirection: "ltr",
  },
  days: {
    fontFamily: fonts.body,
    // Rides along on the code's line at the smallest size on the card: present
    // when looked for, never competing with the code itself.
    fontSize: 10.5,
    fontWeight: "500",
    flexShrink: 0,
  },
  tagsRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  tagText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row-reverse",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnQuiet: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  actionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: "700",
  },
  stamp: {
    position: "absolute",
    top: 52,
    left: 16,
    zIndex: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: "rgba(220, 38, 38, 0.55)",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  stampText: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
    opacity: 0.85,
  },
});
