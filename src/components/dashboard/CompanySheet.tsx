import React from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Image,
  Modal,
  Platform,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Check, Copy, Pencil, X } from "lucide-react-native";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { useCouponViewTracking } from "@/hooks/useCouponViewTracking";
import { getCompanyColor, getCompanyLogoSource, getContrastText } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";
import { useHoldAction } from "@/hooks/useHoldAction";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";

type CouponRowProps = {
  coupon: DecryptedCoupon;
  onOpenCode: () => void;
  onReportUsage: () => void;
  children: React.ReactNode;
  style: any;
};

/**
 * One coupon line in the sheet. A tap enlarges the code; holding it opens the
 * usage report, the same shortcut the coupon cards have.
 */
function CouponRow({ coupon, onOpenCode, onReportUsage, children, style }: CouponRowProps) {
  const usable = coupon.status !== "נוצל";
  const hold = useHoldAction({ onHold: onReportUsage, enabled: usable });

  const fill = hold.progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        if (hold.consumeHold()) return;
        onOpenCode();
      }}
      onPressIn={hold.handlers.onPressIn}
      onPressOut={hold.handlers.onPressOut}
      style={style}
    >
      <Animated.View pointerEvents="none" style={[rowStyles.holdBar, { width: fill }]} />
      {children}
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  holdBar: {
    position: "absolute",
    right: 0,
    bottom: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(37, 99, 235, 0.55)",
  },
});

type CompanySheetProps = {
  company: string | null;
  coupons: DecryptedCoupon[];
  onClose: () => void;
};

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
 * Bottom sheet listing one company's coupons — the `companyModal` in the
 * redesign.
 *
 * The scrim and the sheet animate separately: `animationType="slide"` would
 * translate the whole modal, dragging the dim backdrop up from the bottom with
 * it. Here the backdrop only fades its opacity while the sheet translates,
 * which is how a native sheet behaves.
 */
export function CompanySheet({ company, coupons, onClose }: CompanySheetProps) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { markCompanyViewed, markCodeViewed } = useCouponViewTracking();

  const visible = company !== null;
  const [mounted, setMounted] = React.useState(visible);

  // Keep the last company while the sheet animates out. Without this the header
  // colour is derived from an empty name the moment `company` clears, so the
  // brand colour visibly flips to the fallback blue mid-close.
  const [shown, setShown] = React.useState(company);
  React.useEffect(() => {
    if (company !== null) setShown(company);
  }, [company]);
  const [openCode, setOpenCode] = React.useState<DecryptedCoupon | null>(null);
  const [copied, setCopied] = React.useState(false);

  const progress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 280 : 220,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
        setOpenCode(null);
      }
    });
  }, [visible, progress]);

  // Opening a company is a tracked view — it feeds the automatic balance updater.
  React.useEffect(() => {
    if (company) void markCompanyViewed(company);
  }, [company, markCompanyViewed]);

  const rows = React.useMemo(
    () => coupons.filter((c) => c.company === shown),
    [coupons, shown]
  );

  const total = rows.reduce(
    (sum, c) => sum + Math.max(0, (c.value || 0) - (c.used_value || 0)),
    0
  );

  const brand = getCompanyColor(shown || "");
  const headText = getContrastText(brand);
  const headTextSoft =
    headText === "#ffffff" ? "rgba(255,255,255,0.8)" : "rgba(31,41,55,0.7)";

  // Set when a row is held: the usage modal opens on that coupon.
  const [usageCoupon, setUsageCoupon] = React.useState<DecryptedCoupon | null>(null);

  const handleOpenCode = (coupon: DecryptedCoupon) => {
    setOpenCode(coupon);
    setCopied(false);
    void markCodeViewed(coupon.id);
  };

  const handleCopy = async () => {
    if (!openCode?.code) return;
    await Clipboard.setStringAsync(openCode.code);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Closing the sheet before navigating: leaving the modal mounted would keep it
  // stacked over the edit screen.
  const handleEdit = (coupon: DecryptedCoupon) => {
    setOpenCode(null);
    onClose();
    router.push({
      pathname: "/coupons/edit",
      params: { couponId: String(coupon.id) },
    });
  };

  const drag = React.useRef(new Animated.Value(0)).current;

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        // Only claim clearly-downward drags, so the list keeps its own scrolling.
        onMoveShouldSetPanResponder: (_evt, g) =>
          g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderMove: (_evt, g) => {
          if (g.dy > 0) drag.setValue(g.dy);
        },
        onPanResponderRelease: (_evt, g) => {
          const far = g.dy > 120 || g.vy > 0.8;
          if (far) {
            onClose();
            drag.setValue(0);
          } else {
            Animated.spring(drag, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
            }).start();
          }
        },
      }),
    [drag, onClose]
  );

  React.useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);

  const enterY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });
  const translateY = Animated.add(enterY, drag);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, { opacity: progress }]}>
          {/* No press feedback: Pressable flashed a blue highlight before closing. */}
          <TouchableWithoutFeedback onPress={onClose} accessibilityLabel="סגירה">
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { backgroundColor: theme.card, transform: [{ translateY }] }]}
        >
          <View style={[styles.head, { backgroundColor: brand }]} {...panResponder.panHandlers}>
            <View style={styles.handle} />

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="סגירה">
              <X size={15} color={headText} />
            </TouchableOpacity>

            <View style={styles.headRow}>
              <View style={[styles.logoFrame, { backgroundColor: theme.card }]}>
                <Image
                  source={getCompanyLogoSource(shown || "")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text numberOfLines={1} style={[styles.headTitle, { color: headText }]}>
                {shown}
              </Text>
            </View>

            <Text style={[styles.headMeta, { color: headTextSoft }]}>
              {rows.length} קופונים · יתרה {formatIls(total)}
            </Text>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.body}>
            {rows.map((c) => {
              const days = daysUntil(c.expiration);
              const expired = days !== null && days < 0;
              const soon = days !== null && days >= 0 && days <= 14;
              return (
                <CouponRow
                  key={c.id}
                  coupon={c}
                  onOpenCode={() => handleOpenCode(c)}
                  onReportUsage={() => setUsageCoupon(c)}
                  style={[styles.row, { borderBottomColor: theme.divider }]}
                >
                  {/* Hebrew reads right-to-left: the code leads, the amount trails. */}
                  <View style={styles.rowStart}>
                    <Text style={[styles.code, { color: theme.text }]}>{c.code || "—"}</Text>
                    <Text
                      style={[
                        styles.days,
                        {
                          color: expired
                            ? theme.danger
                            : soon
                              ? theme.warning
                              : theme.success,
                        },
                      ]}
                    >
                      {expired ? "פג תוקף" : soon ? `נותרו ${days} ימים` : "בתוקף"}
                    </Text>
                  </View>

                  <Text style={[styles.remaining, { color: theme.text }]}>
                    {formatIls(Math.max(0, (c.value || 0) - (c.used_value || 0)))}
                  </Text>
                </CouponRow>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Enlarged code, opened by tapping a row */}
        {openCode ? (
          <View style={styles.codeOverlay}>
            <TouchableWithoutFeedback onPress={() => setOpenCode(null)}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>

            <View style={[styles.codeCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.codeCompany, { color: theme.textMuted }]}>
                {openCode.company}
              </Text>

              <Text selectable style={[styles.codeBig, { color: theme.text }]}>
                {openCode.code || "—"}
              </Text>

              <Text style={[styles.codeAmount, { color: theme.textMuted }]}>
                יתרה {formatIls(Math.max(0, (openCode.value || 0) - (openCode.used_value || 0)))}
              </Text>

              <View style={styles.codeActions}>
                <TouchableOpacity
                  onPress={handleCopy}
                  style={[styles.copyBtn, { backgroundColor: theme.primary }]}
                  accessibilityLabel="העתקת קוד"
                >
                  {copied ? <Check size={18} color="#ffffff" /> : <Copy size={18} color="#ffffff" />}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleEdit(openCode)}
                  style={[styles.editBtn, { borderColor: theme.border }]}
                  accessibilityLabel="עריכת קופון"
                >
                  <Pencil size={18} color={theme.text} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setOpenCode(null)} style={styles.codeClose}>
                <Text style={[styles.codeCloseText, { color: theme.textMuted }]}>סגירה</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <QuickUsageModal
          visible={Boolean(usageCoupon)}
          onClose={() => setUsageCoupon(null)}
          coupons={coupons}
          preselectedCoupon={usageCoupon}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  sheet: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? 430 : undefined,
    alignSelf: "center",
    maxHeight: "80%",
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    overflow: "hidden",
  },
  head: {
    padding: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.4)",
    alignSelf: "center",
    marginBottom: 14,
  },
  closeBtn: {
    position: "absolute",
    top: 18,
    left: 18,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  logoFrame: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: "76%",
    height: "76%",
  },
  headTitle: {
    fontFamily: fonts.display,
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
    flexShrink: 1,
  },
  headMeta: {
    fontFamily: fonts.body,
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    marginTop: 4,
    textAlign: "right",
  },
  bodyScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowStart: {
    alignItems: "flex-end",
  },
  code: {
    fontFamily: fonts.display,
    fontSize: 13.5,
    fontWeight: "700",
    writingDirection: "ltr",
  },
  days: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  remaining: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
  },
  codeOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    padding: 24,
  },
  codeCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radii.sheet,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 10,
  },
  codeCompany: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
  },
  codeBig: {
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
    writingDirection: "ltr",
  },
  codeAmount: {
    fontFamily: fonts.body,
    fontSize: 13.5,
  },
  codeActions: {
    marginTop: 8,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    width: "100%",
  },
  copyBtn: {
    height: 46,
    width: 46,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtn: {
    height: 46,
    width: 46,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  codeClose: {
    paddingVertical: 6,
  },
  codeCloseText: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
});
