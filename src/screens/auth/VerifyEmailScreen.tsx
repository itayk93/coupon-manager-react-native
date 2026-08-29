import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MailCheck } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fonts, palette, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activityLog";

const CODE_LENGTH = 6;

export function VerifyEmailScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const address = (email || "").trim().toLowerCase();

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (value: string) => {
    setCode(value.replace(/\D/g, "").slice(0, CODE_LENGTH));
    setError(null);
  };

  const verify = async (token = code) => {
    if (token.length !== CODE_LENGTH || verifying) return;
    setVerifying(true);
    try {
      // "email" rather than "signup": it accepts a code minted by either the
      // signup link or the magic link the resend button asks for, and both
      // confirm the address.
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: address,
        token,
        type: "email",
      });
      if (otpError) throw otpError;

      logActivity("login_success", { metadata: { via: "email_code" } });
      await refreshUser();
      router.replace("/(tabs)");
    } catch {
      setError("הקוד שגוי או שפג תוקפו. אפשר לבקש קוד חדש.");
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (resending || !address) return;
    setResending(true);
    try {
      const { error: sendError } = await supabase.functions.invoke(
        "send-verification-code",
        { body: { mode: "resend", email: address } }
      );
      if (sendError) throw sendError;
      setError(null);
      notify.success("שלחנו קוד חדש", "בדקו את תיבת המייל");
    } catch {
      notify.error("לא הצלחנו לשלוח קוד", "נסו שוב בעוד רגע");
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <View style={styles.icon}>
            <MailCheck size={42} color={palette.primary} />
          </View>

          <Text style={styles.title}>הזינו את הקוד</Text>
          <Text style={styles.body}>
            שלחנו קוד בן {CODE_LENGTH} ספרות ל־{address || "כתובת המייל שלכם"}. הקופון מחכה ויישמר
            מיד אחרי האישור.
          </Text>

          <TextInput
            style={[styles.codeInput, error ? styles.codeInputError : null]}
            value={code}
            onChangeText={onChange}
            onSubmitEditing={() => verify()}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
            maxLength={CODE_LENGTH}
            placeholder="------"
            placeholderTextColor="#C3CBD8"
            accessibilityLabel="קוד אימות"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, code.length !== CODE_LENGTH && styles.buttonDisabled]}
            onPress={() => verify()}
            disabled={code.length !== CODE_LENGTH || verifying}
          >
            {verifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>אישור</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={resend} disabled={resending}>
            <Text style={styles.link}>{resending ? "שולח..." : "לא הגיע? שליחת קוד חדש"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.secondaryLink}>חזרה להתחברות</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FC" },
  flex: { flex: 1 },
  content: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 },
  icon: { width: 82, height: 82, borderRadius: 20, backgroundColor: "#EAF1FF", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontWeight: "800", fontSize: 28, color: "#172033", textAlign: "center", writingDirection: "rtl" },
  body: { maxWidth: 380, fontFamily: fonts.body, fontSize: 16, lineHeight: 25, color: "#5F6B7C", textAlign: "center", writingDirection: "rtl" },
  codeInput: {
    width: "100%",
    maxWidth: 280,
    height: 62,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#D8DEE9",
    backgroundColor: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 30,
    letterSpacing: 10,
    textAlign: "center",
    color: "#172033",
    marginTop: 4,
  },
  codeInputError: { borderColor: "#DC2626" },
  error: { fontFamily: fonts.body, fontSize: 13, color: "#DC2626", textAlign: "center", writingDirection: "rtl" },
  button: { width: "100%", maxWidth: 380, minHeight: 52, borderRadius: radii.md, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", marginTop: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: "#fff" },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.primary, textAlign: "center" },
  secondaryLink: { fontFamily: fonts.body, fontSize: 13, color: "#5F6B7C", textAlign: "center" },
});
