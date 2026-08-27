import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BellRing, Check } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useNativeNotifications } from "@/hooks/useNativeNotifications";
import { usePwaNotifications } from "@/hooks/usePwaNotifications";
import { hasSeenPushPrimer, markPushPrimerSeen } from "@/lib/onboardingPrefs";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activityLog";
import { fonts, palette, radii } from "@/lib/theme";

/**
 * Our ask, before the operating system's.
 *
 * iOS shows its permission dialog once per install, ever. Ask at the wrong
 * moment and the answer is no, permanently — there is no second dialog, only a
 * trip into Settings that nobody takes. So the question is asked here first, in
 * words that say what the notifications are actually for, and the OS dialog is
 * only reached by someone who has already said yes to us.
 *
 * "לא עכשיו" costs nothing: it closes this and never opens the system prompt,
 * which means the one permanent answer stays unspent. The dashboard's nudge
 * banner is the later second chance.
 */
const REASONS = [
  "נזכיר לך לפני שקופון פג — לפני שהכסף נעלם",
  "נעדכן כששיתפו איתך קופון",
  "נגיד לך כמה חסכת בסוף כל חודש",
];

export function PushPrimer() {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const native = useNativeNotifications();
  const pwa = usePwaNotifications();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const supported = native.isSupported || pwa.isSupported;
  // The two transports name the same state differently: the OS layer says
  // "undetermined", the browser says "default". Both mean nobody has answered.
  const raw = native.isSupported ? native.permission : pwa.permission;
  const unanswered = raw === "undetermined" || raw === "default";
  const alreadyOn = native.isSupported ? native.notificationsEnabled : pwa.notificationsEnabled;

  useEffect(() => {
    let active = true;
    if (!user || !supported || native.isLoading) return;
    // Only ever the undetermined state: "granted" needs nothing and "denied"
    // cannot be undone from inside the app.
    if (alreadyOn || !unanswered) return;
    void hasSeenPushPrimer(user.email).then((seen) => {
      if (active && !seen) setVisible(true);
    });
    return () => { active = false; };
  }, [alreadyOn, native.isLoading, supported, unanswered, user]);

  const close = useCallback(() => {
    setVisible(false);
    void markPushPrimerSeen(user?.email);
  }, [user?.email]);

  const accept = async () => {
    setBusy(true);
    try {
      if (native.isSupported) await native.enable();
      else if (pwa.isSupported) await pwa.enable();
      logActivity("enable_push", { metadata: { source: "primer" } });
      notify.success("מעולה", "נשמור עליך ועל הקופונים");
    } catch (error: any) {
      notify.error("לא הצלחנו להפעיל התראות", error?.message);
    } finally {
      setBusy(false);
      close();
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.iconCircle}>
            <BellRing size={26} color="#fff" />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>שנשמור לך על הקופונים?</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            הדבר היחיד שגרוע יותר מלשכוח קופון הוא לגלות את זה יום אחרי
          </Text>

          <View style={styles.reasons}>
            {REASONS.map((reason) => (
              <View key={reason} style={styles.reasonRow}>
                <View style={styles.tick}><Check size={13} color="#fff" /></View>
                <Text style={[styles.reasonText, { color: theme.textSecondary }]}>{reason}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={accept}
            disabled={busy}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>כן, תזכירו לי</Text>}
          </Pressable>

          <Pressable onPress={close} style={styles.secondary} accessibilityRole="button">
            <Text style={[styles.secondaryText, { color: theme.textMuted }]}>לא עכשיו</Text>
          </Pressable>

          <Text style={[styles.footnote, { color: theme.textSubtle }]}>
            אפשר לבחור בדיוק מה לקבל, ומתי, במסך ההתראות
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    writingDirection: "rtl",
    marginTop: 14,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: "center",
    writingDirection: "rtl",
    marginTop: 6,
  },
  reasons: { alignSelf: "stretch", gap: 10, marginTop: 18, marginBottom: 20 },
  reasonRow: { flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.success,
    alignItems: "center",
    justifyContent: "center",
  },
  reasonText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "right",
    writingDirection: "rtl",
  },
  primary: {
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 16, color: "#fff" },
  secondary: { minHeight: 44, justifyContent: "center", marginTop: 4 },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    writingDirection: "rtl",
    marginTop: 2,
  },
  pressed: { opacity: 0.85 },
});
