import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { BellRing, X } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useNativeNotifications } from "@/hooks/useNativeNotifications";
import { dismissPushNudge, hasDismissedPushNudge } from "@/lib/onboardingPrefs";
import { notify } from "@/lib/notify";
import { fonts, palette } from "@/lib/theme";

/**
 * The reminder ask, deliberately late.
 *
 * Asking for notification permission during the walkthrough asks at the moment
 * of zero commitment — the user has nothing yet, so there is nothing to
 * protect. This waits until there is at least one coupon in the wallet and
 * frames the ask around losing it. One ask: dismissing is permanent, and the
 * switch in settings stays the way back in.
 */
export function PushNudgeBanner({ hasCoupons }: { hasCoupons: boolean }) {
  const { user } = useAuth();
  const { isSupported, permission, subscribed, isLoading, isBusy, enable } = useNativeNotifications();
  const [dismissed, setDismissed] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    void hasDismissedPushNudge(user?.email).then((value) => {
      if (active) setDismissed(value);
    });
    return () => { active = false; };
  }, [user?.email]));

  // "denied" is the OS's answer, and it cannot be re-asked from here — nagging
  // a user who already said no just costs a row on the dashboard.
  if (!hasCoupons || dismissed || isLoading || !isSupported || subscribed || permission !== "undetermined") return null;

  const close = () => { setDismissed(true); void dismissPushNudge(user?.email); };

  const turnOn = async () => {
    try {
      await enable();
      notify.success("מעולה, נזכיר לך לפני שקופון פג");
      close();
    } catch (error: any) {
      notify.error("לא הצלחנו להפעיל התראות", error?.message);
    }
  };

  return <View style={styles.banner}>
    <View style={styles.icon}><BellRing size={18} color="#fff" /></View>
    <View style={styles.copy}>
      <Text style={styles.title}>שנשמור על הקופונים שלך?</Text>
      <Text style={styles.body}>נשלח תזכורת לפני שאחד מהם פג, כדי שלא ילך לאיבוד</Text>
    </View>
    <Pressable onPress={turnOn} disabled={isBusy} style={({ pressed }) => [styles.cta, pressed && styles.pressed]} accessibilityRole="button">
      {isBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.ctaText}>כן, תזכירו לי</Text>}
    </Pressable>
    <Pressable onPress={close} hitSlop={10} style={styles.close} accessibilityLabel="סגירה"><X size={16} color="#5F6B7C" /></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  banner: { minHeight: 68, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: "#FFF7E8", borderWidth: 1, borderColor: "#F5D9A6", flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  icon: { width: 36, height: 36, borderRadius: 8, backgroundColor: palette.warning, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  title: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#172033", textAlign: "right", writingDirection: "rtl" },
  body: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: "#5F6B7C", textAlign: "right", writingDirection: "rtl" },
  cta: { minHeight: 38, paddingHorizontal: 12, borderRadius: 8, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#fff" },
  close: { padding: 4 },
  pressed: { opacity: 0.82 },
});
