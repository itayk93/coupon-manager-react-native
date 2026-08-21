import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
  PanResponder,
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

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
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
  const headerTextSoft = headerText === "#ffffff" ? "rgba(255,255,255,0.75)" : "rgba(31,41,55,0.7)";
  const headerPill = headerText === "#ffffff" ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)";

  const statusLabel = isExpired
    ? "פג תוקף"
    : isFullyUsed
      ? "נוצל"
      : isExpiringSoon
        ? "עומד לפוג"
        : "פעיל";

  const daysLabel = isExpired
    ? "פג תוקף"
    : isFullyUsed
      ? "נוצל במלואו"
      : isExpiringSoon
        ? `נותרו ${days} ימים`
        : "בתוקף";

  const daysColor = isExpired || isFullyUsed
    ? theme.danger
    : isExpiringSoon
      ? theme.warning
      : theme.success;

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

  // "Physical voucher" easter egg: the card is perforated under its header,
  // and pulling the body down opens the tear a little before it snaps back.
  const tear = React.useRef(new Animated.Value(0)).current;
  const tearArmed = React.useRef(false);
  const touchStartedAt = React.useRef(0);
  // The tear gesture must never steal the touch while a hold is filling up.
  const holdingRef = React.useRef(false);
  holdingRef.current = hold.holding;

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => {
          touchStartedAt.current = Date.now();
          return false;
        },
        // Claim the gesture only for a deliberate downward pull that starts
        // after a short hold, so list scrolling is never stolen.
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          !holdingRef.current &&
          gesture.dy > 24 &&
          Math.abs(gesture.dx) < 10 &&
          Date.now() - touchStartedAt.current > 220,
        onPanResponderGrant: () => {
          tearArmed.current = false;
        },
        onPanResponderMove: (_evt, gesture) => {
          // Rubberband: the further you pull, the less it gives.
          const pulled = Math.max(0, gesture.dy);
          const eased = Math.min(1, Math.sqrt(pulled / 90));
          tear.setValue(eased);

          if (eased > 0.7 && !tearArmed.current) {
            tearArmed.current = true;
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
          }
        },
        onPanResponderRelease: () => {
          tearArmed.current = false;
          Animated.spring(tear, {
            toValue: 0,
            useNativeDriver: false,
            friction: 5,
            tension: 90,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(tear, {
            toValue: 0,
            useNativeDriver: false,
            friction: 5,
            tension: 90,
          }).start();
        },
      }),
    [tear],
  );

  // The perforation strip is always visible; pulling only widens the gap.
  const tearGap = tear.interpolate({ inputRange: [0, 1], outputRange: [0, 16] });
  const perfHeight = tear.interpolate({ inputRange: [0, 1], outputRange: [10, 26] });

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
      useNativeDriver: true,
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
          params: { couponId: String(coupon.id) },
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
        <Animated.View style={[styles.stamp, stampStyle]} pointerEvents="none">
          <Text style={[styles.stampText, { color: theme.danger }]}>
            {isExpired ? "פג תוקף" : "נוצל"}
          </Text>
        </Animated.View>
      ) : null}
      {/* Brand header */}
      <View style={[styles.header, { backgroundColor: headerColor }]}>
        <View style={styles.headerTitleGroup}>
          <Text numberOfLines={1} style={[styles.company, { color: headerText }]}>
            {coupon.company || "ללא חברה"}
          </Text>
          {coupon.description ? (
            <Text numberOfLines={1} style={[styles.category, { color: headerTextSoft }]}>
              {coupon.description}
            </Text>
          ) : null}
        </View>

        <View style={[styles.statusPill, { backgroundColor: headerPill }]}>
          <Text style={[styles.statusPillText, { color: headerText }]}>{statusLabel}</Text>
        </View>

        <ShimmerLogo
          source={logoUri}
          size={44}
          style={[styles.logoFrame, { backgroundColor: theme.card }]}
          imageStyle={styles.logoImg}
        />
      </View>

      {/* Hold progress: fills across the card on the way to "report usage" */}
      <Animated.View
        pointerEvents="none"
        style={[styles.holdBar, { width: holdFill, backgroundColor: theme.primary }]}
      />

      {/* Perforation: the tear line the body hangs from */}
      <Animated.View style={[styles.perforation, { height: perfHeight }]}>
        <View style={[styles.perfDashes, { borderTopColor: theme.border }]} />
        <View style={[styles.notch, styles.notchLeft, { backgroundColor: theme.background }]} />
        <View style={[styles.notch, styles.notchRight, { backgroundColor: theme.background }]} />
      </Animated.View>

      {/* Body */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.body, { transform: [{ translateY: tearGap }] }]}
      >
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
          <TouchableOpacity
            onPress={handleCopy}
            style={[styles.actionBtn, { backgroundColor: theme.inputBg }]}
          >
            {copied ? (
              <Check size={14} color={theme.success} />
            ) : null}
            <Text style={[styles.actionText, { color: theme.label }]}>
              {copied ? "הועתק" : "העתקת קוד"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSecondaryAction}
            style={[styles.actionBtn, { backgroundColor: headerColor }]}
          >
            <Text style={[styles.actionText, styles.actionTextOnBrand, { color: headerText }]}>
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
    height: 84,
    paddingHorizontal: 14,
    paddingTop: 14,
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: "flex-end",
    paddingLeft: 8,
  },
  company: {
    fontFamily: fonts.display,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  category: {
    fontFamily: fonts.body,
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginTop: 2,
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
    position: "absolute",
    bottom: -22,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 13,
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
  perforation: {
    width: "100%",
    overflow: "hidden",
  },
  perfDashes: {
    position: "absolute",
    top: 4,
    width: "100%",
    borderTopWidth: 2,
    borderStyle: "dashed",
  },
  notch: {
    position: "absolute",
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  notchLeft: {
    left: -7,
  },
  notchRight: {
    right: -7,
  },
  body: {
    paddingTop: 24,
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
    fontSize: 19,
    fontWeight: "800",
  },
  ofTotal: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  track: {
    height: 10,
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
    alignItems: "center",
    justifyContent: "space-between",
  },
  code: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: "700",
    writingDirection: "ltr",
  },
  days: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: "700",
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
    height: 40,
    borderRadius: radii.md,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: "700",
  },
  actionTextOnBrand: {
    color: "#ffffff",
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
