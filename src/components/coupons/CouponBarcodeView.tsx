import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import QRCodeSVG from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Copy, Check, Eye, EyeOff, QrCode } from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, palette } from "@/lib/theme";
import { notify } from "@/lib/notify";

type CouponBarcodeViewProps = {
  coupon: DecryptedCoupon;
};

export function CouponBarcodeView({ coupon }: CouponBarcodeViewProps) {
  const { theme, isDark } = useAppTheme();
  const [copied, setCopied] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const code = coupon.code || "";

  const handleCopyCode = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setCopied(true);
    notify.success("קוד הקופון הועתק!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenQrModal = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setIsQrModalOpen(true);
  };

  return (
    <View style={styles.container}>
      {/* Main Big Code Card */}
      <View
        style={[
          styles.mainCodeCard,
          {
            backgroundColor: isDark ? theme.card : "#ffffff",
            borderColor: isDark ? theme.border : "rgba(0,0,0,0.06)",
          },
        ]}
      >
        <Text style={[styles.codeCardLabel, { color: theme.textMuted }]}>
          קוד למימוש בקופה / באתר
        </Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleCopyCode}
          style={[
            styles.codeDisplayBox,
            {
              backgroundColor: isDark ? "rgba(22, 163, 74, 0.12)" : "rgba(22, 163, 74, 0.08)",
              borderColor: isDark ? "rgba(22, 163, 74, 0.3)" : "rgba(22, 163, 74, 0.2)",
            },
          ]}
        >
          <Text style={[styles.codeText, { color: palette.success }]} selectable>
            {code || "—"}
          </Text>

          {coupon.card_exp || coupon.cvv ? (
            <View
              style={[
                styles.cardDetailsRow,
                {
                  borderTopColor: isDark ? "rgba(22, 163, 74, 0.3)" : "rgba(22, 163, 74, 0.2)",
                },
              ]}
            >
              {coupon.card_exp ? (
                <View style={styles.cardDetailItem}>
                  <Text style={[styles.cardDetailLabel, { color: theme.textMuted }]}>
                    תוקף:
                  </Text>
                  <Text style={[styles.cardDetailVal, { color: theme.text }]} selectable>
                    {coupon.card_exp}
                  </Text>
                </View>
              ) : null}

              {coupon.card_exp && coupon.cvv ? (
                <View
                  style={[
                    styles.cardDetailDivider,
                    {
                      backgroundColor: isDark ? "rgba(22, 163, 74, 0.3)" : "rgba(22, 163, 74, 0.2)",
                    },
                  ]}
                />
              ) : null}

              {coupon.cvv ? (
                <View style={styles.cardDetailItem}>
                  <Text style={[styles.cardDetailLabel, { color: theme.textMuted }]}>
                    CVV:
                  </Text>
                  <Text style={[styles.cardDetailVal, { color: theme.text }]} selectable>
                    {coupon.cvv}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </TouchableOpacity>

        {/* Action Buttons Row: Copy + Show QR */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleCopyCode}
            style={[
              styles.actionButton,
              copied
                ? { backgroundColor: palette.success }
                : { backgroundColor: theme.primary },
            ]}
          >
            {copied ? (
              <Check size={18} color="#ffffff" />
            ) : (
              <Copy size={18} color="#ffffff" />
            )}
            <Text style={styles.actionButtonText}>
              {copied ? "הועתק!" : "העתק קוד"}
            </Text>
          </TouchableOpacity>

          {code ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleOpenQrModal}
              style={[
                styles.actionButton,
                styles.qrActionButton,
                {
                  backgroundColor: isDark ? theme.surfaceAlt : "#f1f5f9",
                  borderColor: isDark ? theme.border : "#e2e8f0",
                },
              ]}
            >
              <QrCode size={18} color={theme.text} />
              <Text style={[styles.qrActionButtonText, { color: theme.text }]}>
                הצג QR
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

      </View>

      {/* Large QR Code Modal */}
      <Modal
        visible={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="קוד לסריקה בקופה"
        subtitle={coupon.company || "הצג את הברקוד לקופאי"}
      >
        <View style={styles.modalContent}>
          {code ? (
            <View style={styles.modalQrWrapper}>
              <QRCodeSVG
                value={code}
                size={230}
                color="#000000"
                backgroundColor="#ffffff"
              />
            </View>
          ) : (
            <View style={styles.noCodeBox}>
              <QrCode size={48} color={theme.textSubtle} />
              <Text style={[styles.noCodeText, { color: theme.textMuted }]}>
                אין קוד להצגת ברקוד
              </Text>
            </View>
          )}

          <Text style={[styles.modalScanNotice, { color: theme.textMuted }]}>
            📱 הצג לקופאי לסריקה בקופה
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleCopyCode}
            style={[
              styles.modalCodeBox,
              {
                backgroundColor: isDark ? theme.surfaceAlt : "#f8fafc",
                borderColor: isDark ? theme.border : "#e2e8f0",
              },
            ]}
          >
            <View style={styles.modalCodeCopyBadge}>
              {copied ? (
                <Check size={14} color="#ffffff" />
              ) : (
                <Copy size={14} color="#ffffff" />
              )}
              <Text style={styles.modalCodeCopyText}>
                {copied ? "הועתק" : "העתק"}
              </Text>
            </View>
            <Text style={[styles.modalCodeDigits, { color: theme.text }]} selectable>
              {code}
            </Text>
          </TouchableOpacity>

          {coupon.card_exp || coupon.cvv ? (
            <View
              style={[
                styles.modalCardDetailsBox,
                {
                  backgroundColor: isDark ? theme.surfaceAlt : "#f8fafc",
                  borderColor: isDark ? theme.border : "#e2e8f0",
                },
              ]}
            >
              {coupon.card_exp ? (
                <View style={styles.modalCardDetailItem}>
                  <Text style={[styles.modalCardDetailLabel, { color: theme.textMuted }]}>
                    תוקף:
                  </Text>
                  <Text style={[styles.modalCardDetailVal, { color: theme.text }]} selectable>
                    {coupon.card_exp}
                  </Text>
                </View>
              ) : null}
              {coupon.cvv ? (
                <View style={styles.modalCardDetailItem}>
                  <Text style={[styles.modalCardDetailLabel, { color: theme.textMuted }]}>
                    CVV:
                  </Text>
                  <Text style={[styles.modalCardDetailVal, { color: theme.text }]} selectable>
                    {coupon.cvv}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: "100%",
    marginVertical: 10,
  },
  mainCodeCard: {
    width: "100%",
    borderRadius: 24,
    padding: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
  },
  codeCardLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "center",
  },
  codeDisplayBox: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginBottom: 14,
  },
  codeText: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  actionButtonsRow: {
    flexDirection: "row-reverse",
    width: "100%",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  qrActionButton: {
    borderWidth: 1,
  },
  qrActionButtonText: {
    fontSize: 14,
    fontWeight: "800",
  },
  cardDetailsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    marginTop: 14,
    paddingTop: 14,
    paddingHorizontal: 8,
  },
  cardDetailItem: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 8,
  },
  cardDetailLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
  },
  cardDetailVal: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  cardDetailDivider: {
    width: 1.5,
    height: 28,
  },
  // QR Modal Styles
  modalContent: {
    alignItems: "center",
    paddingVertical: 12,
    width: "100%",
  },
  modalQrWrapper: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  noCodeBox: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  noCodeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalScanNotice: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  modalCodeBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
  },
  modalCodeDigits: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.5,
    flex: 1,
    textAlign: "right",
    paddingRight: 8,
  },
  modalCodeCopyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: palette.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalCodeCopyText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  modalCardDetailsBox: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
  },
  modalCardDetailItem: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 8,
  },
  modalCardDetailLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
  },
  modalCardDetailVal: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.5,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});

