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
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, UserPlus, User } from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { storeLegacyUser, LegacyUser } from "@/lib/legacyAuth";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { notify } from "@/lib/notify";

export function RegisterScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { setLegacySession } = useAuth();

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
    if (!validate()) return;
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // 1. Create in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          },
        },
      });

      if (authError) throw authError;

      // 2. Insert or update public.users
      const { data: newUser, error: dbError } = await supabase
        .from("users")
        .insert({
          email: normalizedEmail,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          password_hash: "supabase_managed",
          is_admin: false,
          is_confirmed: true,
          created_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (dbError && !dbError.message.includes("duplicate")) {
        console.warn("DB user sync notice:", dbError.message);
      }

      const sessionUser: LegacyUser = {
        id: (newUser as any)?.id || 0,
        email: normalizedEmail,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        is_admin: false,
        is_confirmed: true,
      };

      await storeLegacyUser(sessionUser);
      setLegacySession(sessionUser);
      notify.success("נרשמת בהצלחה!", "ברוך הבא לארנק הקופונים");
    } catch (err: any) {
      notify.error("שגיאה בהרשמה", err.message || "אירעה שגיאה בעת ההרשמה");
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
          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <View
              style={[
                styles.logoCircle,
                { backgroundColor: theme.isDark ? "#1e293b" : "#f1f5f9" },
              ]}
            >
              <UserPlus size={32} color={theme.primary} />
            </View>
            <Text style={[styles.brandTitle, { color: theme.text }]}>
              יצירת חשבון חדש
            </Text>
            <Text style={[styles.brandSubtitle, { color: theme.textMuted }]}>
              הצטרף לאלפי משתמשים שחוסכים כסף בכל קנייה
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
            {/* First and Last Name in Row */}
            <View style={styles.row}>
              <View style={styles.halfCol}>
                <Input
                  label="שם משפחה *"
                  placeholder="ישראלי"
                  value={lastName}
                  onChangeText={setLastName}
                  error={errors.lastName}
                  icon={<User size={16} color={theme.textMuted} />}
                />
              </View>
              <View style={styles.halfCol}>
                <Input
                  label="שם פרטי *"
                  placeholder="ישראל"
                  value={firstName}
                  onChangeText={setFirstName}
                  error={errors.firstName}
                  icon={<User size={16} color={theme.textMuted} />}
                />
              </View>
            </View>

            <Input
              label="כתובת אימייל *"
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              icon={<Mail size={16} color={theme.textMuted} />}
            />

            <Input
              label="סיסמה (לפחות 6 תווים) *"
              placeholder="••••••••"
              isPassword
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              icon={<Lock size={16} color={theme.textMuted} />}
            />

            <Input
              label="אימות סיסמה *"
              placeholder="••••••••"
              isPassword
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={errors.confirmPassword}
              icon={<Lock size={16} color={theme.textMuted} />}
            />

            {/* Terms Switch */}
            <View style={styles.termsRow}>
              <Switch
                value={agreeTerms}
                onValueChange={setAgreeTerms}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#ffffff"
              />
              <Text style={[styles.termsText, { color: theme.textMuted }]}>
                אני מסכים/ה לתנאי השימוש ומדיניות הפרטיות
              </Text>
            </View>
            {errors.terms ? (
              <Text style={[styles.termsError, { color: theme.danger }]}>
                {errors.terms}
              </Text>
            ) : null}

            <Button
              title="צור חשבון"
              onPress={handleRegister}
              loading={loading}
              style={{ marginTop: 12 }}
            />
          </View>

          {/* Switch to Login */}
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text style={[styles.loginLink, { color: theme.primary }]}>
                התחבר כאן
              </Text>
            </TouchableOpacity>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              כבר רשום?
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
    paddingHorizontal: 20,
    paddingVertical: 24,
    flexGrow: 1,
    justifyContent: "center",
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  brandSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 280,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  row: {
    flexDirection: "row-reverse",
    gap: 10,
  },
  halfCol: {
    flex: 1,
  },
  termsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginVertical: 10,
  },
  termsText: {
    fontSize: 12,
    flex: 1,
    textAlign: "right",
  },
  termsError: {
    fontSize: 12,
    textAlign: "right",
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "800",
  },
});
