import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  Copy,
  Check,
  Calendar,
  Eye,
  ReceiptText,
  AlertTriangle,
  RefreshCw,
} from "lucide-react-native";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { Badge } from "@/components/ui/badge";
import { getCompanyLogo } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
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

function formatDate(dateStr: string | null) {
  if (!dateStr) return "ללא תוקף";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

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

  const remaining = Math.max(0, (coupon.value || 0) - (coupon.used_value || 0));
  const total = coupon.value || 0;
  const usedRatio = total > 0 ? (coupon.used_value || 0) / total : 0;
  const remainingRatio = Math.max(0, 1 - usedRatio);

  const isFullyUsed = coupon.status === "נוצל" || remaining <= 0;
  const isExpiringSoon = React.useMemo(() => {
    if (!coupon.expiration) return false;
    const days = (new Date(coupon.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 14;
  }, [coupon.expiration]);

  const isExpired = React.useMemo(() => {
    if (!coupon.expiration) return false;
    return new Date(coupon.expiration).getTime() < Date.now();
  }, [coupon.expiration]);

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
        {
          backgroundColor: theme.card,
          borderColor: selected
            ? theme.primary
            : isFullyUsed
            ? theme.border
            : theme.cardBorder,
          borderWidth: selected ? 2 : 1,
          opacity: isFullyUsed || isExpired ? 0.75 : 1,
          shadowColor: theme.isDark ? "#000" : "#64748b",
        },
      ]}
    >
      {/* Top Row: Logo, Company Name, Discount Badge, Status */}
      <View style={styles.topRow}>
        <View style={styles.badgesGroup}>
          {isFullyUsed ? (
            <Badge label="נוצל" variant="default" />
          ) : isExpired ? (
            <Badge label="פג תוקף" variant="danger" />
          ) : isExpiringSoon ? (
            <Badge
              label="פג בקרוב"
              variant="warning"
              icon={<AlertTriangle size={12} color="#fbbf24" />}
            />
          ) : (
            <Badge label="פעיל" variant="success" />
          )}

          {coupon.auto_update ? (
            <Badge
              label="אוטומטי"
              variant="secondary"
              icon={<RefreshCw size={10} color="#60a5fa" />}
            />
          ) : null}
        </View>

        <View style={styles.companyInfoGroup}>
          <View style={styles.titleColumn}>
            <Text
              numberOfLines={1}
              style={[styles.companyTitle, { color: theme.text }]}
            >
              {coupon.company}
            </Text>
            {coupon.description ? (
              <Text
                numberOfLines={1}
                style={[styles.descriptionText, { color: theme.textMuted }]}
              >
                {coupon.description}
              </Text>
            ) : null}
          </View>

          <View
            style={[
              styles.logoBox,
              { backgroundColor: theme.isDark ? "#1e293b" : "#f8fafc" },
            ]}
          >
            <Image
              source={{ uri: logoUri }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>

      {/* Balance & Progress Bar */}
      <View style={styles.balanceSection}>
        <View style={styles.balanceValuesRow}>
          <Text style={[styles.totalSub, { color: theme.textMuted }]}>
            מתוך {formatIls(total)}
          </Text>
          <Text style={[styles.remainingVal, { color: theme.primary }]}>
            {formatIls(remaining)}
          </Text>
        </View>

        {/* Progress bar */}
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: theme.isDark ? "#1e293b" : "#e2e8f0" },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(remainingRatio * 100)}%`,
                backgroundColor: isFullyUsed
                  ? "#64748b"
                  : isExpiringSoon
                  ? "#f59e0b"
                  : theme.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* Code Display & One-Touch Copy Button */}
      <View
        style={[
          styles.codeRow,
          {
            backgroundColor: theme.isDark ? "#1e293b" : "#f1f5f9",
            borderColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleCopy}
          style={[
            styles.copyBtn,
            { backgroundColor: copied ? theme.primary : "transparent" },
          ]}
        >
          {copied ? (
            <Check size={16} color="#ffffff" />
          ) : (
            <Copy size={16} color={theme.textMuted} />
          )}
          <Text
            style={[
              styles.copyBtnText,
              { color: copied ? "#ffffff" : theme.text },
            ]}
          >
            {copied ? "הועתק!" : "העתק קוד"}
          </Text>
        </TouchableOpacity>

        <Text
          numberOfLines={1}
          style={[styles.codeText, { color: theme.text }]}
        >
          {coupon.code ? coupon.code : "ללא קוד"}
        </Text>
      </View>

      {/* Bottom Row: Expiration & Tags */}
      <View style={styles.bottomRow}>
        <View style={styles.tagsContainer}>
          {tags.slice(0, 3).map((tag) => (
            <View
              key={tag}
              style={[
                styles.tagChip,
                { backgroundColor: theme.isDark ? "#1e293b" : "#f1f5f9" },
              ]}
            >
              <Text style={[styles.tagText, { color: theme.textMuted }]}>
                #{tag}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.expirationRow}>
          <Text style={[styles.expirationText, { color: theme.textMuted }]}>
            {formatDate(coupon.expiration)}
          </Text>
          <Calendar size={13} color={theme.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  badgesGroup: {
    flexDirection: "row-reverse",
    gap: 6,
  },
  companyInfoGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    flex: 1,
    justifyContent: "flex-start",
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  titleColumn: {
    alignItems: "flex-end",
    flex: 1,
  },
  companyTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  descriptionText: {
    fontSize: 12,
    marginTop: 2,
  },
  balanceSection: {
    marginVertical: 6,
  },
  balanceValuesRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  remainingVal: {
    fontSize: 20,
    fontWeight: "900",
  },
  totalSub: {
    fontSize: 12,
    fontWeight: "600",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    width: "100%",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 10,
  },
  codeText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    flex: 1,
    textAlign: "right",
    paddingRight: 8,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  expirationRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  expirationText: {
    fontSize: 11,
    fontWeight: "500",
  },
  tagsContainer: {
    flexDirection: "row-reverse",
    gap: 4,
  },
  tagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
