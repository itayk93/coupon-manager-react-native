import { useNativeDriver } from "@/lib/animation";
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
import { Check, Copy, ExternalLink, Pencil, ReceiptText, X } from "lucide-react-native";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { useCouponViewTracking } from "@/hooks/useCouponViewTracking";
import { getCompanyColor, getCompanyLogoSource, getContrastText } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";
import { useHoldAction } from "@/hooks/useHoldAction";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";
import { CouponCodeBox } from "@/components/coupons/CouponCodeBox";
import { logActivity } from "@/lib/activityLog";
import { formatIls } from "@/lib/formatIls";
import { formatDateShort, daysUntil } from "@/lib/formatDate";
import { companyKey } from "@/lib/companyName";

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
      <Animated.View style={[rowStyles.holdBar, { width: fill, pointerEvents: "none" }]} />
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
      useNativeDriver,
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
    () => coupons.filter((c) => companyKey(c.company) === companyKey(shown)),
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
    logActivity("view_coupon_code", { couponId: coupon.id });
  };

  // Copy straight from a row, without going through the enlarged-code overlay.
  const [copiedRowId, setCopiedRowId] = React.useState<number | null>(null);

  const copyRowCode = async (coupon: DecryptedCoupon) => {
    if (!coupon.code) return;
    await Clipboard.setStringAsync(coupon.code);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    void markCodeViewed(coupon.id);
    logActivity("view_coupon_code", { couponId: coupon.id });
    setCopiedRowId(coupon.id);
    setTimeout(() => setCopiedRowId(null), 2000);
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

  const handleOpenDetail = (coupon: DecryptedCoupon) => {
    setOpenCode(null);
    onClose();
    router.push(`/coupons/${coupon.id}`);
  };

  const handleReportUsage = (coupon: DecryptedCoupon) => {
    setOpenCode(null);
    setUsageCoupon(coupon);
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
              useNativeDriver,
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
              <X size={18} color={headText} />
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

            <Text
              style={[styles.headMeta, { color: headTextSoft }]}
              maxFontSizeMultiplier={1.3}
            >
              {rows.length === 1
                ? "קופון אחד"
                : `${rows.length} קופונים · יתרה ${formatIls(total)}`}
            </Text>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.body}>
            {rows.map((c) => {
              const total = c.value || 0;
              const used = c.used_value || 0;
              const remaining = Math.max(0, total - used);
              const usedPct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

              const days = daysUntil(c.expiration);
              const isFullyUsed = c.status === "נוצל" || remaining <= 0;
              const isExpired = days !== null && days < 0;
              const isExpiringSoon = days !== null && days >= 0 && days <= 14;

              const formattedExpiry = formatDateShort(c.expiration);
              const daysLabel = isExpired
                ? "פג תוקף"
                : isFullyUsed
                  ? "נוצל במלואו"
                  : isExpiringSoon
                    ? `נותרו ${days} ימים`
                    : formattedExpiry
                      ? `בתוקף עד: ${formattedExpiry}`
                      : "ללא תוקף";

              // A date five years out is not news, and colouring it burns the
              // signal needed by the coupon that expires this week.
              const daysColor = isExpired || isFullyUsed
                ? theme.danger
                : isExpiringSoon
                  ? theme.warning
                  : theme.textMuted;

              const isInactive = isFullyUsed || isExpired;

              return (
                <CouponRow
                  key={c.id}
                  coupon={c}
                  onOpenCode={() => handleOpenCode(c)}
                  onReportUsage={() => setUsageCoupon(c)}
                  style={[
                    styles.couponCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View>
                    <View style={styles.amountRow}>
                      <Text
                        style={[styles.remaining, { color: theme.text }]}
                        maxFontSizeMultiplier={1.3}
                      >
                        {formatIls(remaining)}
                      </Text>
                      {used > 0 ? (
                        <Text style={[styles.ofTotal, { color: theme.textSubtle }]}>
                          מתוך {formatIls(total)}
                        </Text>
                      ) : null}
                    </View>

                    {/* An untouched coupon draws an empty grey bar that says
                        nothing, so the track only appears once there is fill. */}
                    {usedPct > 0 ? (
                      <View style={[styles.track, { backgroundColor: theme.track }]}>
                        <View
                          style={[
                            styles.fill,
                            {
                              width: `${usedPct}%`,
                              backgroundColor: isInactive ? theme.textSubtle : brand,
                            },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.metaRow}>
                    <Text
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.3}
                      style={[styles.code, { color: theme.label }]}
                    >
                      {c.code || "—"}
                    </Text>
                    <Text style={[styles.days, { color: daysColor }]}>{daysLabel}</Text>
                  </View>

                  {/* Copying the code was reachable only by tapping the row, so
                      the one thing the sheet is opened for had no visible
                      affordance. It is now the only filled control in it. */}
                  {c.code ? (
                    <TouchableOpacity
                      onPress={() => copyRowCode(c)}
                      accessibilityRole="button"
                      accessibilityLabel={`העתקת הקוד של ${c.company}`}
                      style={[styles.copyBtn, { backgroundColor: brand }]}
                    >
                      {copiedRowId === c.id ? (
                        <Check size={14} color={headText} />
                      ) : (
                        <Copy size={14} color={headText} />
                      )}
                      <Text style={[styles.copyBtnText, { color: headText }]}>
                        {copiedRowId === c.id ? "הועתק" : "העתקת קוד"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {c.card_exp || c.cvv ? (
                    <View
                      style={[styles.cardDetailsRow, { borderTopColor: theme.divider }]}
                    >
                      {c.card_exp ? (
                        <View style={styles.cardDetailItem}>
                          <Text style={[styles.cardDetailLabel, { color: theme.textMuted }]}>
                            תוקף כרטיס:
                          </Text>
                          <Text style={[styles.cardDetailVal, { color: theme.text }]} selectable>
                            {c.card_exp}
                          </Text>
                        </View>
                      ) : null}

                      {c.card_exp && c.cvv ? (
                        <View
                          style={[
                            styles.cardDetailDivider,
                            { backgroundColor: theme.divider },
                          ]}
                        />
                      ) : null}

                      {c.cvv ? (
                        <View style={styles.cardDetailItem}>
                          <Text style={[styles.cardDetailLabel, { color: theme.textMuted }]}>
                            CVV:
                          </Text>
                          <Text style={[styles.cardDetailVal, { color: theme.text }]} selectable>
                            {c.cvv}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
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
              {/* Brand strip: the same header language as the coupon cards */}
              <View style={[styles.codeHead, { backgroundColor: brand }]}>
                <Text numberOfLines={1} style={[styles.codeCompany, { color: headText }]}>
                  {openCode.company}
                </Text>
                <View style={[styles.codeLogoFrame, { backgroundColor: theme.card }]}>
                  <Image
                    source={getCompanyLogoSource(openCode.company || "")}
                    style={styles.codeLogo}
                    resizeMode="contain"
                  />
                </View>
              </View>

              <View style={styles.codeBody}>
                <CouponCodeBox
                  code={openCode.code || ""}
                  cardExp={openCode.card_exp}
                  cvv={openCode.cvv}
                  label="קוד הקופון"
                  onPress={handleCopy}
                />

                <View style={[styles.codeBalance, { backgroundColor: theme.inputBg }]}>
                  <Text style={[styles.codeBalanceLabel, { color: theme.textMuted }]}>
                    יתרה:
                  </Text>
                  <Text
                    style={[styles.codeBalanceValue, { color: theme.text }]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {formatIls(Math.max(0, (openCode.value || 0) - (openCode.used_value || 0)))}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleCopy}
                  style={[styles.codePrimaryBtn, { backgroundColor: theme.primary }]}
                  accessibilityLabel="העתקת קוד"
                >
                  {copied ? <Check size={16} color="#ffffff" /> : <Copy size={16} color="#ffffff" />}
                  <Text style={styles.codePrimaryText}>
                    {copied ? "הועתק" : "העתקת קוד"}
                  </Text>
                </TouchableOpacity>

                <View style={styles.codeSecondaryRow}>
                  <TouchableOpacity
                    onPress={() => handleReportUsage(openCode)}
                    style={[styles.codeSecondaryBtn, { backgroundColor: theme.inputBg }]}
                    accessibilityLabel="דיווח שימוש"
                  >
                    <ReceiptText size={15} color={theme.label} />
                    <Text numberOfLines={1} style={[styles.codeSecondaryText, { color: theme.label }]}>
                      שימוש
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleOpenDetail(openCode)}
                    style={[styles.codeSecondaryBtn, { backgroundColor: theme.inputBg }]}
                    accessibilityLabel="מעבר לעמוד הקופון"
                  >
                    <ExternalLink size={15} color={theme.label} />
                    <Text numberOfLines={1} style={[styles.codeSecondaryText, { color: theme.label }]}>
                      פרטים
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleEdit(openCode)}
                    style={[styles.codeSecondaryBtn, { backgroundColor: theme.inputBg }]}
                    accessibilityLabel="עריכת קופון"
                  >
                    <Pencil size={15} color={theme.label} />
                    <Text numberOfLines={1} style={[styles.codeSecondaryText, { color: theme.label }]}>
                      עריכה
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => setOpenCode(null)} style={styles.codeClose}>
                  <Text style={[styles.codeCloseText, { color: theme.textMuted }]}>סגירה</Text>
                </TouchableOpacity>
              </View>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
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
    top: 14,
    left: 14,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.7,
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
    paddingTop: 14,
    paddingBottom: 24,
    gap: 12,
  },
  couponCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    overflow: "hidden",
  },
  amountRow: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  remaining: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
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
  copyBtn: {
    height: 40,
    borderRadius: radii.md,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  copyBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "700",
  },
  metaRow: {
    // The code owns its own line: at reading size it no longer shares one with
    // the expiry without truncating.
    alignItems: "flex-end",
    gap: 4,
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
    // The least urgent fact on the card, so it reads last.
    fontSize: 11.5,
    fontWeight: "500",
  },
  cardDetailsRow: {
    // The details sit on the card behind a rule instead of inside a grey pill,
    // which was a third box in an already layered sheet.
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
    overflow: "hidden",
  },
  codeHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  codeCompany: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
    flex: 1,
    textAlign: "right",
  },
  codeLogoFrame: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  codeLogo: {
    width: 28,
    height: 28,
  },
  codeBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    alignItems: "center",
    gap: 10,
  },
  codeBalance: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  codeBalanceLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  codeBalanceValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "800",
  },
  codePrimaryBtn: {
    marginTop: 6,
    width: "100%",
    height: 46,
    borderRadius: radii.lg,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  codePrimaryText: {
    fontFamily: fonts.bodyBold,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  codeSecondaryRow: {
    flexDirection: "row-reverse",
    gap: 8,
    width: "100%",
  },
  codeSecondaryBtn: {
    flex: 1,
    height: 42,
    borderRadius: radii.lg,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
  },
  codeSecondaryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: "700",
  },
  codeClose: {
    paddingVertical: 6,
  },
  codeCloseText: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
});
