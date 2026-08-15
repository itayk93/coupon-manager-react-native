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
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Mail, KeyRound, ArrowRight } from "lucide-react-native";
import { AuthStackParamList } from "@/navigation/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAppTheme } from "@/contexts/ThemeContext";
import { notify } from "@/lib/notify";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: Props) {
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
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase()
      );
      if (resetError) throw resetError;

      setSent(true);
      notify.success("הוראות שחזור נשלחו למייל!");
    } catch (err: any) {
      notify.error("שגיאה בשחזור סיסמה", err.message || "לא הצלחנו לשלוח הוראות שחזור");
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
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[
              styles.backButton,
              { backgroundColor: theme.isDark ? "#1e293b" : "#f1f5f9" },
            ]}
          >
            <ArrowRight size={20} color={theme.text} />
          </TouchableOpacity>

          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <View
              style={[
                styles.logoCircle,
                { backgroundColor: theme.isDark ? "#1e293b" : "#f1f5f9" },
              ]}
            >
              <KeyRound size={32} color={theme.primary} />
            </View>
            <Text style={[styles.brandTitle, { color: theme.text }]}>
              איפוס סיסמה
            </Text>
            <Text style={[styles.brandSubtitle, { color: theme.textMuted }]}>
              הזן את כתובת האימייל ונשלח אליך קישור לאיפוס הסיסמה
            </Text>
          </View>

          {/* Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            {sent ? (
              <View style={styles.sentContainer}>
                <Text style={[styles.sentTitle, { color: theme.primary }]}>
                  הקישור נשלח בהצלחה! ✉️
                </Text>
                <Text style={[styles.sentDesc, { color: theme.textMuted }]}>
                  בדוק את תיבת הדואר הנכנס שלך (כולל ספאם) לקבלת הוראות איפוס.
                </Text>
                <Button
                  title="חזרה להתחברות"
                  onPress={() => navigation.navigate("Login")}
                  style={{ marginTop: 20 }}
                />
              </View>
            ) : (
              <>
                <Input
                  label="כתובת אימייל"
                  placeholder="your@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(val: string) => {
                    setEmail(val);
                    setError("");
                  }}
                  error={error}
                  icon={<Mail size={16} color={theme.textMuted} />}
                />

                <Button
                  title="שלח קישור לאיפוס"
                  onPress={handleReset}
                  loading={loading}
                  style={{ marginTop: 10 }}
                />
              </>
            )}
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    alignSelf: "flex-end",
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
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
    padding: 22,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  sentContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  sentTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  sentDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
