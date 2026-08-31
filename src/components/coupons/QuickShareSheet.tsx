import React, { useState } from "react";
import { Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import QRCodeSVG from "react-native-qrcode-svg";
import { QrCode, Send, TriangleAlert } from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";
import { shareLinkUrl } from "@/lib/shareLinks";
import { useCreateShareLink } from "@/hooks/useShareLink";
import type { ShareType } from "@/hooks/useSharing";

type Props = {
  visible: boolean;
  onClose: () => void;
  couponId: number;
  company: string;
  remaining: number;
};

/**
 * Handing a coupon to someone standing next to you.
 *
 * iOS gives no way for two phones to exchange anything by touching, so the
 * closest honest version of that is a single-use link: the system share sheet
 * puts AirDrop one tap away, and the QR code covers the friend who does not
 * appear in it. Both carry the same token, and the first person to claim it
 * closes it for everyone else.
 *
 * The coupon code itself never travels here — only a token that has to be
 * redeemed against the server by a signed-in account.
 */
export function QuickShareSheet({ visible, onClose, couponId, company, remaining }: Props) {
  const { theme } = useAppTheme();
  const [shareType, setShareType] = useState<ShareType>("shared");
  const [token, setToken] = useState<string | null>(null);
  const createLink = useCreateShareLink();

  const url = token ? shareLinkUrl(token) : null;

  const close = () => {
    // The link stays valid on the server; this only forgets it locally. Anyone
    // who needs it back can revoke or re-issue from the sharing screen.
    setToken(null);
    setShareType("shared");
    onClose();
  };

  const handleCreate = async () => {
    const link = await createLink.mutateAsync({ couponId, shareType });
    setToken(link.token);
  };

  const handleSend = async () => {
    if (!url) return;
    try {
      await Share.share({
        message: `קופון ל-${company} בשבילך: ${url}`,
        url,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const options: { type: ShareType; title: string; body: string }[] = [
    {
      type: "shared",
      title: "שיתוף",
      body: "שניכם משתמשים מאותה יתרה. הקופון נשאר שלך.",
    },
    {
      type: "transfer",
      title: "העברה",
      body: "הקופון עובר אליו ויוצא מהארנק שלך. אי אפשר לבטל.",
    },
  ];

  return (
    <Modal
      visible={visible}
      onClose={close}
      title={url ? "מוכן לשליחה" : "שתף עכשיו"}
      subtitle={url ? undefined : `${company} · ${formatIls(remaining)}`}
    >
      {url ? (
        <View style={styles.body}>
          <View style={[styles.qrFrame, { backgroundColor: "#ffffff", borderColor: theme.border }]}>
            <QRCodeSVG value={url} size={190} backgroundColor="#ffffff" color="#000000" />
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            {shareType === "transfer"
              ? "החבר סורק או מקבל את הקישור, מאשר, והקופון עובר אליו."
              : "החבר סורק או מקבל את הקישור, מאשר, ומתחיל להשתמש מאותה יתרה."}
          </Text>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            הקישור חד־פעמי ופג תוך 24 שעות. אפשר לבטל אותו במסך השיתופים.
          </Text>
          <Button
            title="שלח דרך AirDrop או הודעה"
            onPress={handleSend}
            icon={<Send size={18} color="#ffffff" />}
          />
        </View>
      ) : (
        <View style={styles.body}>
          {options.map((option) => {
            const active = shareType === option.type;
            return (
              <TouchableOpacity
                key={option.type}
                activeOpacity={0.85}
                onPress={() => setShareType(option.type)}
                style={[
                  styles.option,
                  {
                    backgroundColor: active ? theme.primaryTint : theme.surfaceAlt,
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}
              >
                <Text style={[styles.optionTitle, { color: theme.text }]}>{option.title}</Text>
                <Text style={[styles.optionBody, { color: theme.textMuted }]}>{option.body}</Text>
              </TouchableOpacity>
            );
          })}

          {shareType === "transfer" ? (
            <View style={styles.warning}>
              <TriangleAlert size={16} color={theme.dangerText} />
              <Text style={[styles.warningText, { color: theme.dangerText }]}>
                העברה היא סופית. אחרי שהחבר יאשר, הקופון כבר לא יהיה שלך.
              </Text>
            </View>
          ) : null}

          <Button
            title="צור קישור"
            onPress={handleCreate}
            disabled={createLink.isPending}
            loading={createLink.isPending}
            icon={<QrCode size={18} color="#ffffff" />}
          />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, alignItems: "stretch" },
  option: { borderWidth: 1.5, borderRadius: radii.lg, padding: 14, gap: 4 },
  optionTitle: { fontFamily: fonts.bodyBold, fontSize: 16, textAlign: "right" },
  optionBody: { fontFamily: fonts.body, fontSize: 13, textAlign: "right", lineHeight: 19 },
  warning: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  warningText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: "right" },
  qrFrame: {
    alignSelf: "center",
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  hint: { fontFamily: fonts.body, fontSize: 13, textAlign: "center", lineHeight: 19 },
});
