import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MailCheck } from "lucide-react-native";
import { fonts, palette, radii } from "@/lib/theme";

export function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.icon}><MailCheck size={42} color={palette.primary} /></View>
        <Text style={styles.title}>נשאר לאשר את המייל</Text>
        <Text style={styles.body}>שלחנו קישור אישור ל־{email || "כתובת המייל שלכם"}. הקופון מחכה ויישמר מיד אחרי הכניסה.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace("/(auth)/login")}>
          <Text style={styles.buttonText}>חזרה להתחברות</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FC" },
  content: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 18 },
  icon: { width: 82, height: 82, borderRadius: 20, backgroundColor: "#EAF1FF", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontWeight: "800", fontSize: 28, color: "#172033", textAlign: "center", writingDirection: "rtl" },
  body: { maxWidth: 380, fontFamily: fonts.body, fontSize: 16, lineHeight: 25, color: "#5F6B7C", textAlign: "center", writingDirection: "rtl" },
  button: { width: "100%", maxWidth: 380, minHeight: 52, borderRadius: radii.md, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", marginTop: 10 },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: "#fff" },
});
