import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { getCompanyColor, getCompanyLogo } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";
import { notify } from "@/lib/notify";

type CouponCardProps = {
  coupon: DecryptedCoupon;
  tags?: string[];
  onPress: () => void;
  onReportUsage?: () => void;
  selected?: boolean;
  onSelect?: () => void;
  showSelect?: boolean;
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
 * Coupon card from the redesign: a brand-coloured header with the company logo
 * overlapping its lower edge, then balance, usage bar, code and two actions.
 */
export function CouponCard({
  coupon,
  tags = [],
  onPress,
  onReportUsage,
  selected = false,
  onSelect,
  showSelect = false,
}: CouponCardProps) {
  const { theme } = useAppTheme();
  const [copied, setCopied] = React.useState(false);

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
    notify.success("הקוד הועתק ללוח!", coupon.code);
    setTimeout(() => setCopied(false), 2000);
  };

  const logoUri = getCompanyLogo(coupon.company);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={showSelect ? onSelect : onPress}
      style={[
        styles.card,
        shadows.card,
        {
          backgroundColor: theme.card,
          borderColor: selected ? theme.primary : "transparent",
          borderWidth: selected ? 2 : 0,
          opacity: isFullyUsed || isExpired ? 0.75 : 1,
        },
      ]}
    >
      {/* Brand header */}
      <View style={[styles.header, { backgroundColor: headerColor }]}>
        <View style={styles.headerTitleGroup}>
          <Text numberOfLines={1} style={styles.company}>
            {coupon.company || "ללא חברה"}
          </Text>
          {coupon.description ? (
            <Text numberOfLines={1} style={styles.category}>
              {coupon.description}
            </Text>
          ) : null}
        </View>

        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{statusLabel}</Text>
        </View>

        <View style={[styles.logoFrame, { backgroundColor: theme.card }]}>
          <Image source={{ uri: logoUri }} style={styles.logoImg} resizeMode="contain" />
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
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
            onPress={(e: any) => {
              e?.stopPropagation?.();
              onReportUsage ? onReportUsage() : onPress();
            }}
            style={[styles.actionBtn, { backgroundColor: headerColor }]}
          >
            <Text style={[styles.actionText, styles.actionTextOnBrand]}>דיווח שימוש</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
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
  body: {
    paddingTop: 32,
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
});
