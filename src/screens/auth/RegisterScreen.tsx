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
  Switch,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Mail, Lock, User } from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, palette, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activityLog";

export function RegisterScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "יש להזין שם פרטי";
    if (!lastName.trim()) errs.lastName = "יש להזין שם משפחה";
    if (!email.trim()) {
      errs.email = "יש להזין כתובת אימייל";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errs.email = "כתובת אימייל לא תקינה";
    }
    if (!password || password.length < 6) {
      errs.password = "סיסמה חייבת להכיל לפחות 6 תווים";
    }
    if (password !== confirmPassword) {
      errs.confirmPassword = "הסיסמאות אינן תואמות";
    }
    if (!agreeTerms) {
      errs.terms = "יש לאשר את תנאי השימוש ומדיניות הפרטיות";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (loading) return;
    if (!validate()) return;
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Not signUp(): that mails Supabase's own confirmation link on the
      // built-in SMTP, whose quota is a couple of messages an hour for the
      // whole project. The function below creates the same unconfirmed user
      // and sends the six-digit code through Brevo, like the rest of our mail.
      const { data, error: sendError } = await supabase.functions.invoke(
        "send-verification-code",
        {
          body: {
            mode: "signup",
            email: normalizedEmail,
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          },
        }
      );

      if (sendError) {
        const detail = (sendError as any).context?.json
          ? await (sendError as any).context.json().catch(() => null)
          : null;
        const code = detail?.error ?? data?.error;
        throw new Error(
          code === "EMAIL_TAKEN"
            ? "כבר קיים חשבון עם האימייל הזה. התחברו בשיטה הקיימת וקשרו שיטה נוספת מהפרופיל."
            : "לא הצלחנו לשלוח את קוד האימות. נסו שוב בעוד רגע."
        );
      }

      logActivity("register_success", { metadata: { needs_verification: true } });

      router.replace({
        pathname: "/(auth)/onboarding",
        params: { pendingVerification: normalizedEmail },
      });
      return;
    } catch (err: any) {
      notify.error("שגיאה בהרשמה", err.message || "אירעה שגיאה בעת ההרשמה");
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

            <Text style={[styles.title, { color: theme.text }]}>יצירת חשבון</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              חוסכים כסף כבר בדקה הראשונה
            </Text>

            <Input
              label="שם מלא"
              placeholder="ישראל ישראלי"
              value={firstName}
              onChangeText={setFirstName}
              error={errors.firstName}
              icon={<User size={18} color={theme.textSubtle} />}
            />

            <Input
              label="שם משפחה"
              placeholder="ישראלי"
              value={lastName}
              onChangeText={setLastName}
              error={errors.lastName}
              icon={<User size={18} color={theme.textSubtle} />}
            />

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

            <Input
              label="אימות סיסמה"
              placeholder="••••••••"
              isPassword
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              returnKeyType="done"
              enablesReturnKeyAutomatically
              onSubmitEditing={() => void handleRegister()}
              error={errors.confirmPassword}
              icon={<Lock size={18} color={theme.textSubtle} />}
            />

            <View style={styles.termsRow}>
              <Switch
                value={agreeTerms}
                onValueChange={setAgreeTerms}
                trackColor={{ false: theme.inputBorder, true: theme.primary }}
                thumbColor="#ffffff"
              />
              <Text style={[styles.termsText, { color: theme.textMuted }]}>
                אני מאשר/ת את תנאי השימוש
              </Text>
            </View>

            <TouchableOpacity activeOpacity={0.85} onPress={handleRegister} disabled={loading}>
              <LinearGradient
                colors={[palette.primary, palette.primaryDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submit}
              >
                <Text style={styles.submitText}>{loading ? "נרשם..." : "הרשמה"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                <Text style={[styles.link, { color: theme.primary }]}>התחברות</Text>
              </TouchableOpacity>
              <Text style={[styles.footerText, { color: theme.textMuted }]}>כבר יש לכם חשבון?</Text>
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
  termsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  termsText: { fontFamily: fonts.body, fontSize: 13 },
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
  legal: {
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
});
