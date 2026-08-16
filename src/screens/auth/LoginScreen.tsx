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
import { Mail, Lock, LogIn, ArrowRight } from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signInLegacy } from "@/lib/legacyAuth";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { notify } from "@/lib/notify";

export function LoginScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { setLegacySession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      const user = await signInLegacy(email, password);
      setLegacySession(user);
      notify.success(`ברוך הבא, ${user.first_name || user.email}!`);
    } catch (err: any) {
      notify.error("שגיאת התחברות", err.message || "אימייל או סיסמה שגויים");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Brand Header */}
          <View style={styles.brandHeader}>
            <View
              style={[
                styles.logoCircle,
                { backgroundColor: theme.surfaceAlt },
              ]}
            >
              <LogIn size={36} color={theme.primary} />
            </View>
            <Text style={[styles.brandTitle, { color: theme.text }]}>
              Coupon Master
            </Text>
            <Text style={[styles.brandSubtitle, { color: theme.textMuted }]}>
              כל הקופונים והשוברים שלך במקום אחד מאובטח
            </Text>
          </View>

          {/* Form Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Text style={[styles.formTitle, { color: theme.text }]}>
              התחברות לחשבון
            </Text>

            <Input
              label="אימייל"
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              icon={<Mail size={18} color={theme.textMuted} />}
            />

            <Input
              label="סיסמה"
              placeholder="••••••••"
              isPassword
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              icon={<Lock size={18} color={theme.textMuted} />}
            />

            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-password")}
              style={styles.forgotBtn}
            >
              <Text style={[styles.forgotText, { color: theme.primary }]}>
                שכחת סיסמה?
              </Text>
            </TouchableOpacity>

            <Button
              title="התחבר"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginBtn}
            />
          </View>

          {/* Switch to Register */}
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text style={[styles.registerLink, { color: theme.primary }]}>
                הרשם עכשיו
              </Text>
            </TouchableOpacity>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              אין לך חשבון עדיין?
            </Text>
          </View>
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
    paddingHorizontal: 24,
    paddingVertical: 32,
    flexGrow: 1,
    justifyContent: "center",
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  brandSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 260,
  },
  card: {
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 20,
  },
  forgotBtn: {
    alignSelf: "flex-start",
    marginBottom: 20,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "700",
  },
  loginBtn: {
    marginTop: 4,
  },
  footerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 28,
  },
  footerText: {
    fontSize: 14,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: "800",
  },
});
