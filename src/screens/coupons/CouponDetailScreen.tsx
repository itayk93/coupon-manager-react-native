import React, { useState } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  Edit3,
  Trash2,
  Share2,
  ReceiptText,
  ExternalLink,
  CheckCircle2,
  Clock,
  Tag,
  History,
  AlertTriangle,
  LayoutGrid,
  Minus,
  Plus,
} from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { CouponBarcodeView } from "@/components/coupons/CouponBarcodeView";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useCoupon,
  useDeleteCoupon,
  useUpdateCoupon,
  DecryptedCoupon,
} from "@/hooks/useCoupons";
import { useCouponTags, useSetCouponTags } from "@/hooks/useTags";
import { useCouponViewTracking } from "@/hooks/useCouponViewTracking";
import {
  useCouponUsageHistory,
  useDeleteTransactionRecord,
} from "@/hooks/useCouponUsage";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { useWidgetToggle } from "@/hooks/useWidgetToggle";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
import { notify } from "@/lib/notify";

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "ללא תוקף";
  try {
    return new Date(dateStr).toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Confirmation for deleting a history record. It unfolds under the row it
 * belongs to instead of throwing a system alert over the screen, so the record
 * being deleted stays visible while the choice is made.
 */
function DeleteConfirm({
  theme,
  busy,
  onCancel,
  onConfirm,
}: {
  theme: ReturnType<typeof useAppTheme>["theme"];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.confirmCard,
        {
          backgroundColor: theme.dangerBg,
          borderColor: theme.dangerBorder,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
          ],
        },
      ]}
    >
      <Text style={[styles.confirmTitle, { color: theme.dangerText }]}>
        למחוק את הרשומה?
      </Text>
      <Text style={[styles.confirmBody, { color: theme.dangerText }]}>
        יתרת הקופון תחושב מחדש, והקופון יחזור לפעילים אם ייווצר בו זיכוי.
      </Text>

      <View style={styles.confirmActions}>
        <TouchableOpacity
          disabled={busy}
          onPress={onConfirm}
          style={[styles.confirmBtn, { backgroundColor: theme.danger }]}
        >
          <Text style={[styles.confirmBtnText, { color: "#ffffff" }]}>מחיקה</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCancel}
          style={[styles.confirmBtn, { backgroundColor: theme.card }]}
        >
          <Text style={[styles.confirmBtnText, { color: theme.text }]}>ביטול</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export function CouponDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const parsedId = Number(id);
  const couponId = Number.isInteger(parsedId) ? parsedId : undefined;
  const { theme } = useAppTheme();

  const { data: coupon, isLoading } = useCoupon(couponId);
  const { data: tags = [] } = useCouponTags(couponId);
  const { data: history = [] } = useCouponUsageHistory(coupon || null);
  const deleteCoupon = useDeleteCoupon();
  const updateCoupon = useUpdateCoupon();
  const deleteTx = useDeleteTransactionRecord();
  const widget = useWidgetToggle(coupon);

  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [isEditingHistory, setIsEditingHistory] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Feeds the automatic balance updater, same as the legacy app.
  const { markDetailViewed } = useCouponViewTracking();
  React.useEffect(() => {
    if (couponId !== undefined) void markDetailViewed(couponId);
  }, [couponId, markDetailViewed]);

  if (isLoading || !coupon) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <Header title="טוען קופון..." showBack onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <Text style={{ color: theme.textMuted }}>טוען נתוני קופון...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const remaining = Math.max(0, (coupon.value || 0) - (coupon.used_value || 0));
  const isFullyUsed = coupon.status === "נוצל" || remaining <= 0;

  const daysLeft = coupon.expiration
    ? Math.ceil((new Date(coupon.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const handleDelete = () => {
    notify.confirm(
      "מחיקת קופון",
      `האם אתה בטוח שברצונך למחוק את הקופון של ${coupon.company}?`,
      async () => {
        await deleteCoupon.mutateAsync(coupon.id);
        router.back();
      },
      "מחק"
    );
  };

  const handleMarkAsUsed = async () => {
    notify.confirm(
      "סימון כנוצל",
      "האם לסמן את כל יתרת הקופון כנוצלת?",
      async () => {
        await updateCoupon.mutateAsync({
          id: coupon.id,
          updates: {
            used_value: coupon.value,
            status: "נוצל",
          },
        });
      },
      "סמן כנוצל"
    );
  };

  const handleOpenUrl = async () => {
    const url =
      coupon.buyme_coupon_url ||
      coupon.strauss_coupon_url ||
      coupon.xgiftcard_coupon_url ||
      coupon.xtra_coupon_url;
    if (url) {
      await WebBrowser.openBrowserAsync(url);
    }
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: `קופון ל-${coupon.company}\nקוד: ${coupon.code}\nשווי: ${formatIls(
          remaining
        )}`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const logo = getCompanyLogoSource(coupon.company);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header
        title={coupon.company}
        showBack
        onBack={() => router.back()}
        rightAction={
          <View style={styles.headerRightGroup}>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/coupons/edit", params: { couponId: String(coupon.id) } })}
              style={[styles.headerIconBtn, { backgroundColor: theme.surfaceAlt }]}
            >
              <Edit3 size={18} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDelete}
              style={[styles.headerIconBtn, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}
            >
              <Trash2 size={18} color={theme.danger} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Company Header Box */}
        <View
          style={[
            styles.companyBox,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.companyHeaderTop}>
            <View style={styles.statusBadges}>
              {isFullyUsed ? (
                <Badge label="נוצל במלואו" variant="default" />
              ) : daysLeft !== null && daysLeft < 0 ? (
                <Badge label="פג תוקף" variant="danger" />
              ) : daysLeft !== null && daysLeft <= 14 ? (
                <Badge
                  label={`פג בעוד ${daysLeft} ימים`}
                  variant="warning"
                  icon={<Clock size={12} color={theme.warningText} />}
                />
              ) : (
                <Badge label="פעיל בארנק" variant="success" />
              )}
            </View>

            <View style={styles.logoAndName}>
              <View style={styles.nameGroup}>
                <Text style={[styles.companyMainTitle, { color: theme.text }]}>
                  {coupon.company}
                </Text>
              </View>

              <View
                style={[
                  styles.companyLogoFrame,
                  { backgroundColor: theme.surfaceAlt },
                ]}
              >
                <Image source={logo} style={styles.companyLogoImg} resizeMode="contain" />
              </View>
            </View>
          </View>

          {/* Balance Gauge */}
          <View
            style={[
              styles.gaugeContainer,
              { backgroundColor: theme.surfaceAlt },
            ]}
          >
            <View style={styles.gaugeRow}>
              <View style={styles.gaugeCol}>
                <Text style={[styles.gaugeLabel, { color: theme.textMuted }]}>נוצל</Text>
                <Text style={[styles.gaugeVal, { color: theme.textMuted }]}>
                  {formatIls(coupon.used_value || 0)}
                </Text>
              </View>

              <View style={styles.gaugeCol}>
                <Text style={[styles.gaugeLabel, { color: theme.textMuted }]}>שווי מקורי</Text>
                <Text style={[styles.gaugeVal, { color: theme.text }]}>
                  {formatIls(coupon.value || 0)}
                </Text>
              </View>

              <View style={styles.gaugeCol}>
                <Text style={[styles.gaugeLabel, { color: theme.textMuted }]}>יתרה זמינה</Text>
                <Text style={[styles.gaugeValHighlight, { color: theme.primary }]}>
                  {formatIls(remaining)}
                </Text>
              </View>
            </View>
          </View>

        </View>

        {/* Barcode & QR Code Presentation Box */}
        <CouponBarcodeView coupon={coupon} />

        {coupon.expiration ? (
          <View
            style={[
              styles.expirationRow,
              { backgroundColor: theme.surfaceAlt },
            ]}
          >
            <Text style={[styles.expirationLabel, { color: theme.textMuted }]}>
              תוקף הקופון
            </Text>
            <Text
              style={[
                styles.expirationValue,
                {
                  color:
                    daysLeft !== null && daysLeft < 0
                      ? theme.danger
                      : daysLeft !== null && daysLeft <= 14
                      ? theme.warningText
                      : theme.text,
                },
              ]}
            >
              {formatDate(coupon.expiration)}
            </Text>
          </View>
        ) : null}

        {coupon.description ? (
          <View
            style={[
              styles.descriptionCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Text style={[styles.descriptionLabel, { color: theme.textMuted }]}>תיאור</Text>
            <Text style={[styles.companyDescription, { color: theme.textMuted }]}>
              {coupon.description}
            </Text>
          </View>
        ) : null}

        {/* Action Buttons Row */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setIsUsageOpen(true)}
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
          >
            <ReceiptText size={18} color="#ffffff" />
            <Text style={styles.actionBtnTextWhite}>דיווח שימוש</Text>
          </TouchableOpacity>

          {!isFullyUsed ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleMarkAsUsed}
              style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt }]}
            >
              <CheckCircle2 size={18} color={theme.text} />
              <Text style={[styles.actionBtnText, { color: theme.text }]}>סמן כנוצל</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleNativeShare}
            style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt }]}
          >
            <Share2 size={18} color={theme.text} />
            <Text style={[styles.actionBtnText, { color: theme.text }]}>שתף</Text>
          </TouchableOpacity>
        </View>

        {/* Redemption Link if available */}
        {coupon.buyme_coupon_url ||
        coupon.strauss_coupon_url ||
        coupon.xgiftcard_coupon_url ||
        coupon.xtra_coupon_url ? (
          <TouchableOpacity
            onPress={handleOpenUrl}
            style={[
              styles.externalLinkBtn,
              {
                backgroundColor: theme.surfaceAlt,
                borderColor: theme.border,
              },
            ]}
          >
            <ExternalLink size={18} color={theme.secondary} />
            <Text style={[styles.externalLinkText, { color: theme.secondary }]}>
              פתיחת שובר מקוון באתר החברה
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Home-screen widget */}
        {widget.canToggle ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              widget.inWidget
                ? `הסר את ${coupon.company} מהווידג'ט`
                : `הוסף את ${coupon.company} לווידג'ט`
            }
            activeOpacity={0.85}
            disabled={widget.disabled}
            onPress={widget.toggle}
            style={[
              styles.widgetRow,
              {
                backgroundColor: widget.inWidget ? theme.primaryTint : theme.card,
                borderColor: widget.inWidget ? theme.primary : theme.cardBorder,
                opacity: widget.disabled ? 0.5 : 1,
              },
            ]}
          >
            <LayoutGrid size={18} color={theme.primary} />
            <View style={styles.widgetRowText}>
              <Text style={[styles.widgetRowTitle, { color: theme.text }]}>
                {widget.inWidget ? "מוצג בווידג'ט מסך הבית" : "הצג בווידג'ט מסך הבית"}
              </Text>
              <Text style={[styles.widgetRowSubtitle, { color: theme.textMuted }]}>
                {widget.inWidget
                  ? "לחץ כדי להסיר מהווידג'ט"
                  : widget.isFull
                    ? `הווידג'ט מלא - עד ${widget.maxCoupons} קופונים`
                    : "גישה מהירה לקוד בלי לפתוח את האפליקציה"}
              </Text>
            </View>
            {widget.inWidget ? (
              <Minus size={18} color={theme.danger} />
            ) : (
              <Plus size={18} color={widget.isFull ? theme.textSubtle : theme.primary} />
            )}
          </TouchableOpacity>
        ) : null}

        {/* Tags */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>תגיות</Text>
            <Tag size={16} color={theme.primary} />
          </View>
          <View style={styles.tagsRow}>
            {tags.length > 0 ? (
              tags.map((t) => (
                <View
                  key={t.id}
                  style={[
                    styles.tagBubble,
                    { backgroundColor: theme.surfaceAlt },
                  ]}
                >
                  <Text style={[styles.tagBubbleText, { color: theme.primary }]}>
                    #{t.name}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>אין תגיות לקופון זה</Text>
            )}
          </View>
        </View>

        {/* Usage & Transaction History */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              היסטוריית שימושים וטעינות
            </Text>
            <View style={styles.historyHeaderActions}>
              {history.some((h) => h.source_table !== "sum_row" && typeof h.id === "number") ? (
                <TouchableOpacity
                  onPress={() => {
                    setPendingDeleteId(null);
                    setIsEditingHistory((prev) => !prev);
                  }}
                  style={[
                    styles.historyEditToggle,
                    {
                      backgroundColor: isEditingHistory ? theme.primary : theme.neutralBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.historyEditToggleText,
                      { color: isEditingHistory ? "#fff" : theme.text },
                    ]}
                  >
                    {isEditingHistory ? "סיום" : "עריכה"}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <History size={16} color={theme.primary} />
            </View>
          </View>

          {history.length > 0 ? (
            history.map((h) => {
              const isNegative = h.transaction_amount < 0;
              const canDelete = h.source_table !== "sum_row" && typeof h.id === "number";
              const isPendingDelete = pendingDeleteId === String(h.id);
              return (
                <View key={String(h.id)}>
                  <View
                    style={[
                      styles.historyRow,
                      { borderBottomColor: theme.border },
                      isPendingDelete && { borderBottomWidth: 0 },
                    ]}
                  >
                    {/* RTL: the row reads from the right, so its action sits at
                        the end of the line — the left edge. */}
                    {isEditingHistory && canDelete ? (
                      <TouchableOpacity
                        onPress={() =>
                          setPendingDeleteId(isPendingDelete ? null : String(h.id))
                        }
                        style={[
                          styles.historyDeleteBtn,
                          {
                            backgroundColor: isPendingDelete
                              ? theme.danger
                              : theme.dangerBg,
                          },
                        ]}
                        accessibilityLabel="מחיקת רשומה"
                      >
                        <Trash2
                          size={16}
                          color={isPendingDelete ? "#ffffff" : theme.danger}
                        />
                      </TouchableOpacity>
                    ) : null}

                    <Text
                      style={[
                        styles.historyAmount,
                        {
                          color:
                            h.source_table === "sum_row"
                              ? theme.primary
                              : isNegative
                              ? theme.danger
                              : theme.primary,
                        },
                      ]}
                    >
                      {isNegative ? "-" : "+"}
                      {formatIls(Math.abs(h.transaction_amount))}
                    </Text>

                    <View style={styles.historyDetailsCol}>
                      <Text style={[styles.historyDetails, { color: theme.text }]}>
                        {h.details}
                      </Text>
                      {h.timestamp ? (
                        <Text style={[styles.historyDate, { color: theme.textMuted }]}>
                          {formatDate(h.timestamp)}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {isPendingDelete ? (
                    <DeleteConfirm
                      theme={theme}
                      busy={deleteTx.isPending}
                      onCancel={() => setPendingDeleteId(null)}
                      onConfirm={() => {
                        setPendingDeleteId(null);
                        deleteTx.mutate(
                          {
                            recordId: h.id,
                            sourceTable: h.source_table,
                            couponId: coupon.id,
                          },
                          {
                            onSuccess: () =>
                              notify.success("הרשומה נמחקה", "יתרת הקופון עודכנה"),
                          }
                        );
                      }}
                    />
                  ) : null}
                </View>
              );
            })
          ) : (
            <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 12 }}>
              טרם נרשמו שימושים לקופון זה
            </Text>
          )}
        </View>
      </ScrollView>

      <QuickUsageModal
        visible={isUsageOpen}
        onClose={() => setIsUsageOpen(false)}
        coupons={[coupon]}
        preselectedCoupon={coupon}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 40,
  },
  headerRightGroup: {
    flexDirection: "row",
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  companyBox: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  companyHeaderTop: {
    marginBottom: 4,
  },
  statusBadges: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
    marginBottom: 14,
  },
  logoAndName: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 14,
    flex: 1,
    justifyContent: "flex-start",
  },
  nameGroup: {
    alignItems: "flex-end",
    flex: 1,
    minWidth: 0,
  },
  companyMainTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "right",
  },
  companyDescription: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "right",
  },
  descriptionCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 12,
  },
  descriptionLabel: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 8,
  },
  companyLogoFrame: {
    width: 52,
    height: 52,
    flexShrink: 0,
    borderRadius: 16,
    padding: 4,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  companyLogoImg: {
    width: "100%",
    height: "100%",
  },
  gaugeContainer: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  gaugeRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  gaugeCol: {
    alignItems: "center",
    justifyContent: "flex-start",
    flex: 1,
    gap: 6,
  },
  gaugeLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 0,
  },
  gaugeVal: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "800",
  },
  gaugeValHighlight: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "900",
  },
  expirationRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 12,
  },
  expirationLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  expirationValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "left",
  },
  actionsGrid: {
    flexDirection: "row-reverse",
    gap: 10,
    marginVertical: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
  },
  actionBtnTextWhite: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  externalLinkBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
  },
  externalLinkText: {
    fontSize: 13,
    fontWeight: "700",
  },
  sectionCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  widgetRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  widgetRowText: { flex: 1, gap: 2 },
  widgetRowTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    textAlign: "right",
  },
  widgetRowSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "right",
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "800",
  },
  tagsRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  tagBubble: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagBubbleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyAmount: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: "800",
  },
  historyDetailsCol: {
    alignItems: "flex-end",
  },
  historyDetails: {
    fontSize: 13,
    fontWeight: "600",
  },
  historyDate: {
    fontSize: 11,
    marginTop: 2,
  },
  historyHeaderActions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  historyEditToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  historyEditToggleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  historyDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  confirmTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  confirmBody: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "right",
    opacity: 0.9,
  },
  confirmActions: {
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 4,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
