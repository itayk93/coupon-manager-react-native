import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, ChevronRight, KeyRound, Mail } from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, palette, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";

// Where the recovery link in the email lands. Without it Supabase falls back to
// the project's Site URL, which drops the user on the home screen already
// signed in and with no way to actually pick a new password.
const WEB_APP_ORIGIN = "https://coupons.itaykarkason.com";

export function ForgotPasswordScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("יש להזין כתובת אימייל תקינה");
      return;
    }
    setError("");
    setLoading(true);

    try {
      // Native included: the link is opened from a mail client, so it has to
      // resolve to the web app rather than to a custom scheme.
      const redirectTo =
        Platform.OS === "web"
          ? Linking.createURL("reset-password")
          : `${WEB_APP_ORIGIN}/reset-password`;

      // Not resetPasswordForEmail(): that goes out on Supabase's built-in
      // SMTP, whose quota is a couple of messages an hour for the whole
      // project. The function below generates the same recovery link and sends
      // it through Brevo, like the rest of the mail this app sends.
      const { error: resetError } = await supabase.functions.invoke(
        "send-password-reset",
        { body: { email: email.trim().toLowerCase(), redirectTo } }
      );
      if (resetError) throw resetError;

      setSent(true);
    } catch (err: any) {
      notify.error("שגיאה בשחזור סיסמה", err.message || "לא הצלחנו לשלוח הוראות שחזור");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#e8f2fd", "#f5f6fd", "#f5f6fd"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Image
              source={require("../../../public/logo-icon.png")}
              style={styles.brandMark}
              resizeMode="contain"
            />
            <Text style={[styles.brandName, { color: theme.text }]}>קופון מאסטר</Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <LinearGradient
              colors={[palette.primary, palette.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardRule}
            />

            <Text style={[styles.title, { color: theme.text }]}>שחזור סיסמה</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {sent
                ? "שלחנו לכם קישור לאיפוס הסיסמה"
                : "הזינו את האימייל ונשלח קישור לאיפוס"}
            </Text>

            {sent ? (
              <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/(auth)/login")}>
                <LinearGradient
                  colors={[palette.primary, palette.primaryDeep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submit}
                >
                  <Text style={styles.submitText}>חזרה להתחברות</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <>
                <Input
                  label="אימייל"
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  error={error}
                  icon={<Mail size={18} color={theme.textSubtle} />}
                />

                <TouchableOpacity activeOpacity={0.85} onPress={handleReset} disabled={loading}>
                  <LinearGradient
                    colors={[palette.primary, palette.primaryDeep]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submit}
                  >
                    <Text style={styles.submitText}>
                      {loading ? "שולח..." : "שליחת קישור"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.footerRow}>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={[styles.link, { color: theme.primary }]}>חזרה</Text>
              </TouchableOpacity>
              <Text style={[styles.footerText, { color: theme.textMuted }]}>נזכרתם בסיסמה?</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  brand: { alignItems: "center", gap: 10, marginBottom: 28 },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: radii.card,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 8px 20px rgba(31, 111, 209, 0.28)",
    elevation: 6,
  },
  brandName: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderRadius: radii.sheet,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 32,
    overflow: "hidden",
    boxShadow: "0px 20px 50px rgba(16, 24, 40, 0.18)",
    elevation: 8,
  },
  cardRule: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  submit: {
    height: 48,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontFamily: fonts.bodyBold,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  link: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: "600" },
  footerRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
    gap: 4,
  },
  footerText: { fontFamily: fonts.body, fontSize: 13 },
});
