import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft, Sparkles } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { hasCompletedOnboarding } from "@/lib/onboardingStatus";
import { fonts, palette } from "@/lib/theme";

export function OnboardingBanner() {
  const router = useRouter();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void hasCompletedOnboarding(user?.email).then((completed) => {
      if (active) setVisible(!completed);
    });
    return () => { active = false; };
  }, [user?.email]));

  if (!visible) return null;
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
  banner: { minHeight: 68, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: "#EEF4FF", borderWidth: 1, borderColor: "#CFE0FF", flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  icon: { width: 36, height: 36, borderRadius: 8, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 }, title: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#172033", textAlign: "right", writingDirection: "rtl" },
  body: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: "#5F6B7C", textAlign: "right", writingDirection: "rtl" }, pressed: { opacity: 0.82 },
});
