import React, { useState } from "react";
import {
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
  ExternalLink,
  ReceiptText,
  CheckCircle2,
  Clock,
  Tag,
  History,
  AlertTriangle,
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
import {
  useCouponUsageHistory,
  useDeleteTransactionRecord,
} from "@/hooks/useCouponUsage";
import { getCompanyLogo } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
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

  const [isUsageOpen, setIsUsageOpen] = useState(false);

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

  const logo = getCompanyLogo(coupon.company);

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
                  icon={<Clock size={12} color="#fbbf24" />}
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
                {coupon.description ? (
                  <Text style={[styles.companyDescription, { color: theme.textMuted }]}>
                    {coupon.description}
                  </Text>
                ) : null}
              </View>

              <View
                style={[
                  styles.companyLogoFrame,
                  { backgroundColor: theme.surfaceAlt },
                ]}
              >
                <Image source={{ uri: logo }} style={styles.companyLogoImg} resizeMode="contain" />
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
                <Text style={[styles.gaugeVal, { color: "#64748b" }]}>
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
            <History size={16} color={theme.primary} />
          </View>

          {history.length > 0 ? (
            history.map((h) => {
              const isNegative = h.transaction_amount < 0;
              return (
                <View
                  key={String(h.id)}
                  style={[
                    styles.historyRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.historyAmount,
                      {
                        color:
                          h.source_table === "sum_row"
                            ? theme.primary
                            : isNegative
                            ? theme.danger
                            : "#3b82f6",
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
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statusBadges: {
    flexDirection: "row-reverse",
  },
  logoAndName: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    flex: 1,
    justifyContent: "flex-start",
  },
  nameGroup: {
    alignItems: "flex-end",
    flex: 1,
  },
  companyMainTitle: {
    fontSize: 19,
    fontWeight: "900",
  },
  companyDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  companyLogoFrame: {
    width: 52,
    height: 52,
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
    padding: 12,
  },
  gaugeRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  gaugeCol: {
    alignItems: "center",
    flex: 1,
  },
  gaugeLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  gaugeVal: {
    fontSize: 15,
    fontWeight: "800",
  },
  gaugeValHighlight: {
    fontSize: 17,
    fontWeight: "900",
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
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
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
});
