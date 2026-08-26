import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft, Sparkles } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { hasCompletedOnboarding } from "@/lib/onboardingStatus";
import { fonts, palette } from "@/lib/theme";

/**
 * Whether the walkthrough is still waiting for this user.
 *
 * Lifted out of the banner so the dashboard can also use it to decide what
 * else to show: two stacked banners at the top of a fresh account read as
 * clutter, and the walkthrough is the one that goes away on its own.
 */
export function useOnboardingPending(): boolean {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void hasCompletedOnboarding(user?.email).then((completed) => {
      if (active) setPending(!completed);
    });
    return () => { active = false; };
  }, [user?.email]));

  return pending;
}

/**
 * Rendered inside the dashboard's scroll content rather than in the tab shell.
 * The shell has no safe-area inset of its own — the screens each apply one —
 * so a banner sitting there rendered underneath the status bar, and pushed the
 * screen below it into applying the inset a second time.
 */
export function OnboardingBanner() {
  const router = useRouter();
  if (!useOnboardingPending()) return null;

  return <Pressable onPress={() => router.push("/(auth)/onboarding")} style={({ pressed }) => [styles.banner, pressed && styles.pressed]} accessibilityRole="button">
    <View style={styles.icon}><Sparkles size={18} color="#fff" /></View>
    <View style={styles.copy}>
      <Text style={styles.title}>הקופון הראשון שלך עוד מחכה</Text>
      <Text style={styles.body}>דקה קטנה, ואנחנו מכניסים אותו לארנק</Text>
    </View>
    <ChevronLeft size={20} color={palette.primary} />
  </Pressable>;
}

const styles = StyleSheet.create({
  // No horizontal margin: the scroll content it sits in already has 16pt of
  // padding, and a margin on top of that inset it twice.
  banner: { minHeight: 68, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: "#EEF4FF", borderWidth: 1, borderColor: "#CFE0FF", flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  icon: { width: 36, height: 36, borderRadius: 8, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 }, title: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#172033", textAlign: "right", writingDirection: "rtl" },
  body: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: "#5F6B7C", textAlign: "right", writingDirection: "rtl" }, pressed: { opacity: 0.82 },
});
