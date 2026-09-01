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
import Svg, { Path } from "react-native-svg";
import { Input } from "@/components/ui/input";
import { signInLegacy } from "@/lib/legacyAuth";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, palette, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";
import { signInWithSocialProvider } from "@/lib/socialAuth";
import { logActivity } from "@/lib/activityLog";

function AppleLogo() {
  return (
    <Svg width={19} height={23} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill="#ffffff"
        d="M17.05 12.54c-.03-3.18 2.6-4.72 2.72-4.79a5.84 5.84 0 0 0-4.6-2.49c-1.94-.2-3.82 1.16-4.81 1.16-1.01 0-2.54-1.14-4.18-1.1a6.08 6.08 0 0 0-5.12 3.12c-2.23 3.86-.57 9.53 1.57 12.65 1.07 1.53 2.32 3.24 3.96 3.18 1.6-.07 2.2-1.02 4.13-1.02 1.91 0 2.48 1.02 4.15.98 1.72-.03 2.8-1.53 3.82-3.08a12.6 12.6 0 0 0 1.75-3.56 5.5 5.5 0 0 1-3.39-5.05ZM13.9 3.2A5.56 5.56 0 0 0 15.17-.8a5.65 5.65 0 0 0-3.65 1.9 5.3 5.3 0 0 0-1.3 3.86A4.68 4.68 0 0 0 13.9 3.2Z"
      />
    </Svg>
  );
}

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
      logActivity("login_success", { metadata: { method: provider } });
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
    if (loading) return;
    if (!validate()) return;
    setLoading(true);

    try {
      const user = await signInLegacy(email, password);
      setLegacySession(user);
      logActivity("login_success", { metadata: { method: "password" } });
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
                testID="login-email"
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
                testID="login-password"
                placeholder="••••••••"
                isPassword
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                enablesReturnKeyAutomatically
                onSubmitEditing={() => void handleLogin()}
                error={errors.password}
                icon={<Lock size={18} color={theme.textSubtle} />}
              />

              <TouchableOpacity
                onPress={() => router.push("/(auth)/forgot-password")}
                style={styles.forgotRow}
              >
                <Text style={[styles.link, { color: theme.primary }]}>שכחתי סיסמה</Text>
              </TouchableOpacity>

              <TouchableOpacity testID="login-submit" activeOpacity={0.85} onPress={handleLogin} disabled={loading}>
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
                <AppleLogo />
                <Text style={[styles.socialText, styles.appleText]}>
                  {socialLoading === "apple" ? "מתחבר..." : "המשך עם Apple"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerRow}>
              <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
                <Text style={[styles.link, { color: theme.primary }]}>הרשמה</Text>
              </TouchableOpacity>
              <Text style={[styles.footerText, { color: theme.textMuted }]}>אין לכם חשבון?</Text>
            </View>
          </View>

          <Text style={[styles.legal, { color: theme.textSubtle }]}>
            השימוש באפליקציה כפוף ל
            <Text style={{ color: theme.primary }} onPress={() => router.push("/terms")}>
              תנאי השימוש
            </Text>
            {" ול"}
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
  appleText: {
    color: "#ffffff",
  },
  footerRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
    gap: 4,
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
