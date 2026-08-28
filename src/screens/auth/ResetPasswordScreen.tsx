import React, { useEffect, useState } from "react";
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
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Lock } from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { clearLegacyUser } from "@/lib/legacyAuth";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, palette, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";

type Status = "checking" | "ready" | "invalid";

/**
 * Landing screen for the recovery link in the reset-password email. Supabase
 * hands us a real (recovery) session on arrival, so the only thing standing
 * between the link and the account is this form: without it the link simply
 * logs the visitor in and the password is never changed.
 */
export function ResetPasswordScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // The link can fail before any session exists (expired or already used);
    // Supabase reports that in the URL fragment rather than as a query param.
    const linkError =
      Platform.OS === "web" && typeof window !== "undefined"
        ? new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description")
        : null;

    if (linkError) {
      setStatus("invalid");
      notify.error("הקישור אינו תקף", "קישור האיפוס פג תוקף או שכבר נעשה בו שימוש");
      return;
    }

    // On web the session is parsed out of the URL asynchronously, so listen for
    // the recovery event as well as checking what is already stored.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted && session) setStatus("ready");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setStatus((current) => {
        if (current !== "checking") return current;
        return data.session ? "ready" : "invalid";
      });
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    const errs: { password?: string; confirmPassword?: string } = {};
    if (password.length < 6) errs.password = "הסיסמה חייבת להכיל לפחות 6 תווים";
    if (password !== confirmPassword) errs.confirmPassword = "הסיסמאות אינן תואמות";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // The recovery session is torn down on purpose: the new password should
      // be typed once to prove it took, instead of the link doubling as a login.
      await supabase.auth.signOut();
      await clearLegacyUser();

      notify.success("הסיסמה עודכנה", "אפשר להתחבר עם הסיסמה החדשה");
      router.replace("/(auth)/login");
    } catch (err: any) {
      notify.error("עדכון הסיסמה נכשל", err.message || "נסו שוב או בקשו קישור איפוס חדש");
    } finally {
      setSaving(false);
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

            <Text style={[styles.title, { color: theme.text }]}>סיסמה חדשה</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {status === "invalid"
                ? "קישור האיפוס אינו תקף יותר"
                : "בחרו סיסמה חדשה לחשבון שלכם"}
            </Text>

            {status === "checking" ? (
              <ActivityIndicator color={theme.primary} style={styles.loader} />
            ) : status === "invalid" ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.replace("/(auth)/forgot-password")}
              >
                <LinearGradient
                  colors={[palette.primary, palette.primaryDeep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submit}
                >
                  <Text style={styles.submitText}>בקשת קישור חדש</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <>
                <Input
                  label="סיסמה חדשה"
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
                  error={errors.confirmPassword}
                  icon={<Lock size={18} color={theme.textSubtle} />}
                />

                <TouchableOpacity activeOpacity={0.85} onPress={handleSubmit} disabled={saving}>
                  <LinearGradient
                    colors={[palette.primary, palette.primaryDeep]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submit}
                  >
                    <Text style={styles.submitText}>
                      {saving ? "מעדכן..." : "עדכון סיסמה"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.footerRow}>
              <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                <Text style={[styles.link, { color: theme.primary }]}>חזרה להתחברות</Text>
              </TouchableOpacity>
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
  loader: { marginVertical: 12 },
  submit: {
    height: 48,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
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
  },
});
