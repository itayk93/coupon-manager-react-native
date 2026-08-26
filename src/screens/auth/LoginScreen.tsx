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
import { LinearGradient } from "expo-linear-gradient";
import { Mail, Lock } from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { signInLegacy } from "@/lib/legacyAuth";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, palette, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";
import { signInWithSocialProvider } from "@/lib/socialAuth";

export function LoginScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { setLegacySession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errs.email = "יש להזין כתובת אימייל";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errs.email = "כתובת אימייל לא תקינה";
    }
    if (!password) {
      errs.password = "יש להזין סיסמה";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSocialLogin = async (provider: "google" | "apple") => {
    setSocialLoading(provider);
    try {
      await signInWithSocialProvider(provider);
      if (Platform.OS !== "web") {
        router.replace({ pathname: "/(auth)/onboarding", params: { social: provider } });
      }
    } catch (err: any) {
      notify.error(
        provider === "google" ? "התחברות עם Google" : "התחברות עם Apple",
        err.message || "ההתחברות נכשלה. נסו שוב.",
      );
    } finally {
      setSocialLoading(null);
    }
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      const user = await signInLegacy(email, password);
      setLegacySession(user);
    } catch (err: any) {
      notify.error("שגיאת התחברות", err.message || "אימייל או סיסמה שגויים");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Radial wash behind the card, per the design */}
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
          {/* Brand */}
          <View style={styles.brand}>
            <Image
              source={require("../../../public/logo-icon.png")}
              style={styles.brandMark}
              resizeMode="contain"
            />
            <Text style={[styles.brandName, { color: theme.text }]}>קופון מאסטר</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <LinearGradient
              colors={[palette.primary, palette.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardRule}
            />

            <Text style={[styles.title, { color: theme.text }]}>ברוכים השבים</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              התחברו כדי לנהל את הקופונים שלכם
            </Text>

            <View style={styles.fields}>
              <Input
                label="אימייל"
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                icon={<Mail size={18} color={theme.textSubtle} />}
              />

              <Input
                label="סיסמה"
                placeholder="••••••••"
                isPassword
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                icon={<Lock size={18} color={theme.textSubtle} />}
              />

              <TouchableOpacity
                onPress={() => router.push("/(auth)/forgot-password")}
                style={styles.forgotRow}
              >
                <Text style={[styles.link, { color: theme.primary }]}>שכחתי סיסמה</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.85} onPress={handleLogin} disabled={loading}>
                <LinearGradient
                  colors={[palette.primary, palette.primaryDeep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submit}
                >
                  <Text style={styles.submitText}>{loading ? "מתחבר..." : "התחברות"}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: theme.cardBorder }]} />
                <Text style={[styles.dividerText, { color: theme.textSubtle }]}>הרשמה מהירה עם</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.cardBorder }]} />
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleSocialLogin("google")}
                disabled={socialLoading !== null}
                style={[
                  styles.socialBtn,
                  { backgroundColor: theme.card, borderColor: theme.inputBorder },
                ]}
              >
                <Text style={styles.googleIcon}>G</Text>
                <Text style={[styles.socialText, { color: theme.label }]}>
                  {socialLoading === "google" ? "מתחבר..." : "המשך עם Google"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleSocialLogin("apple")}
                disabled={socialLoading !== null}
                style={[styles.socialBtn, styles.appleBtn]}
              >
                <Text style={styles.appleIcon}></Text>
                <Text style={[styles.socialText, styles.appleText]}>
                  {socialLoading === "apple" ? "מתחבר..." : "המשך עם Apple"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerRow}>
              <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
                <Text style={[styles.link, { color: theme.primary }]}>הרשמה</Text>
              </TouchableOpacity>
              <Text style={[styles.footerText, { color: theme.textMuted }]}>אין לכם חשבון? </Text>
            </View>
          </View>

          <Text style={[styles.legal, { color: theme.textSubtle }]}>
            בכניסה אתם מאשרים את{" "}
            <Text style={{ color: theme.primary }} onPress={() => router.push("/privacy")}>
              מדיניות הפרטיות
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  brand: {
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: radii.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
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
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 50,
    elevation: 8,
  },
  cardRule: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
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
  fields: {
    gap: 0,
  },
  forgotRow: {
    alignSelf: "flex-start",
    marginTop: -6,
    marginBottom: 10,
  },
  link: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "600",
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
  dividerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  socialBtn: {
    height: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row-reverse",
    gap: 10,
    marginBottom: 10,
  },
  socialText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "600",
  },
  googleIcon: {
    color: "#4285f4",
    fontSize: 18,
    fontWeight: "800",
  },
  appleBtn: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },
  appleIcon: {
    color: "#ffffff",
    fontSize: 21,
  },
  appleText: {
    color: "#ffffff",
  },
  footerRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  footerText: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  legal: {
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
});
