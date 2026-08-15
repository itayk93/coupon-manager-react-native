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
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { notify } from "@/lib/notify";

type CouponBarcodeViewProps = {
  coupon: DecryptedCoupon;
};

export function CouponBarcodeView({ coupon }: CouponBarcodeViewProps) {
  const [copied, setCopied] = useState(false);
  const [showCvv, setShowCvv] = useState(false);

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

  return (
    <View style={styles.container}>
      {/* QR Code Presentation Box */}
      <View style={styles.qrCard}>
        {code ? (
          <View style={styles.qrWrapper}>
            <QRCodeSVG
              value={code}
              size={180}
              color="#000000"
              backgroundColor="#ffffff"
            />
          </View>
        ) : (
          <View style={styles.noCodeBox}>
            <QrCode size={48} color="#94a3b8" />
            <Text style={styles.noCodeText}>אין קוד להצגת ברקוד</Text>
          </View>
        )}

        <Text style={styles.scanNotice}>
          📱 הצג לקופאי לסריקה בקופה
        </Text>
      </View>

      {/* Big Code Row with Copy Button */}
      <View style={styles.codeBox}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleCopyCode}
          style={styles.copyButton}
        >
          {copied ? (
            <Check size={18} color="#ffffff" />
          ) : (
            <Copy size={18} color="#ffffff" />
          )}
          <Text style={styles.copyButtonText}>
            {copied ? "הועתק!" : "העתק"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.codeDigits} selectable>
          {code || "—"}
        </Text>
      </View>

      {/* CVV & Card Exp if available */}
      {coupon.cvv || coupon.card_exp ? (
        <View style={styles.cardInfoBox}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowCvv(!showCvv)}
            style={styles.revealBtn}
          >
            {showCvv ? (
              <EyeOff size={16} color="#60a5fa" />
            ) : (
              <Eye size={16} color="#60a5fa" />
            )}
            <Text style={styles.revealText}>
              {showCvv ? "הסתר פרטי כרטיס" : "הצג פרטי כרטיס"}
            </Text>
          </TouchableOpacity>

          <View style={styles.cardFieldsRow}>
            {coupon.card_exp ? (
              <View style={styles.fieldItem}>
                <Text style={styles.fieldLabel}>תוקף:</Text>
                <Text style={styles.fieldVal}>
                  {showCvv ? coupon.card_exp : "••/••"}
                </Text>
              </View>
            ) : null}

            {coupon.cvv ? (
              <View style={styles.fieldItem}>
                <Text style={styles.fieldLabel}>CVV:</Text>
                <Text style={styles.fieldVal}>
                  {showCvv ? coupon.cvv : "•••"}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: "100%",
    marginVertical: 10,
  },
  qrCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    width: "100%",
    maxWidth: 280,
  },
  qrWrapper: {
    padding: 10,
    backgroundColor: "#ffffff",
    borderRadius: 16,
  },
  noCodeBox: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  noCodeText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
  },
  scanNotice: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    textAlign: "center",
  },
  codeBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
    width: "100%",
    borderWidth: 1,
    borderColor: "#334155",
  },
  codeDigits: {
    color: "#34d399",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
    flex: 1,
    textAlign: "right",
    paddingRight: 8,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  copyButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  cardInfoBox: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    padding: 12,
    marginTop: 12,
    width: "100%",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardFieldsRow: {
    flexDirection: "row-reverse",
    gap: 16,
  },
  fieldItem: {
    flexDirection: "row-reverse",
    gap: 4,
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
  },
  fieldVal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#60a5fa",
  },
  revealBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  revealText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#60a5fa",
  },
});
