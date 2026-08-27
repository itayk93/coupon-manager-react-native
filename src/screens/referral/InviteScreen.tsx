import React from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Copy, Share2 } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useMyReferralStatus } from "@/hooks/useReferral";
import { referralShareMessage, referralUrl } from "@/lib/referral";
import { fonts, radii, shadows } from "@/lib/theme";
import { notify } from "@/lib/notify";

const APP_BASE_URL = "https://coupons.itaykarkason.com";

/**
 * Where someone in a referral chain gets their own link.
 *
 * The numbers shown are counts and nothing else — no names, no addresses of
 * the people who joined. Someone who invited four friends does not need, and
 * should not get, a list of what those friends are doing in the app.
 */
export function InviteScreen() {
  const { theme } = useAppTheme();
  const { data: status, isLoading } = useMyReferralStatus();

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <Header title="הזמנת חברים" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!status) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <Header title="הזמנת חברים" />
        <View style={styles.center}>
          <Text style={[styles.muted, { color: theme.textMuted }]}>
            ההזמנות אינן פתוחות בחשבון הזה כרגע.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const link = referralUrl(APP_BASE_URL, status.code);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="הזמנת חברים" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.label, { color: theme.textMuted }]}>הקוד שלך</Text>
          <Text style={[styles.code, { color: theme.text }]}>{status.code}</Text>
          <Text style={[styles.link, { color: theme.textMuted }]} numberOfLines={1}>
            {link}
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() =>
              Share.share({ message: referralShareMessage(APP_BASE_URL, status.code) }).catch(
                () => {},
              )
            }
          >
            <Share2 size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>שיתוף הקישור</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={async () => {
              await Clipboard.setStringAsync(link);
              notify.success("הקישור הועתק");
            }}
          >
            <Copy size={16} color={theme.textMuted} />
            <Text style={[styles.secondaryButtonText, { color: theme.textMuted }]}>העתקה</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.label, { color: theme.textMuted }]}>מי הצטרף דרכך</Text>
          <View style={styles.statRow}>
            <Stat label="הצטרפו" value={status.joined} color={theme.text} muted={theme.textMuted} />
            <Stat label="התחילו להשתמש" value={status.activated} color={theme.text} muted={theme.textMuted} />
            <Stat label="נשארו" value={status.retained} color={theme.text} muted={theme.textMuted} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  color,
  muted,
}: {
  label: string;
  value: number;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  content: { padding: 16, gap: 16 },
  card: { borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 8, ...shadows.card },
  label: { fontFamily: fonts.body, fontSize: 13 },
  code: { fontFamily: fonts.display, fontSize: 34, letterSpacing: 4, textAlign: "center" },
  link: { fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginBottom: 8 },
  muted: { fontFamily: fonts.body, fontSize: 15, textAlign: "center" },
  primaryButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.md,
    paddingVertical: 14,
  },
  primaryButtonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: "#fff" },
  secondaryButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  secondaryButtonText: { fontFamily: fonts.body, fontSize: 14 },
  statRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 4 },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontFamily: fonts.display, fontSize: 26 },
  statLabel: { fontFamily: fonts.body, fontSize: 12, textAlign: "center" },
});
