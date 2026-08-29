import React, { useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import QRCodeSVG from "react-native-qrcode-svg";
import { ShieldCheck } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/button";
import { useAdminMfa } from "@/hooks/useAdminMfa";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";

/**
 * Wraps the admin panel with a TOTP prompt. Nothing about the regular app is
 * touched — a user who never opens the panel never sees this.
 */
export function AdminMfaGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { status, enrolling, busy, error, startEnrollment, cancelEnrollment, verifyCode } =
    useAdminMfa();
  const [code, setCode] = useState("");

  if (status === "verified") return <>{children}</>;

  const submit = async () => {
    if (code.trim().length < 6) {
      notify.error("יש להזין קוד בן 6 ספרות");
      return;
    }
    const ok = await verifyCode(code);
    setCode("");
    if (ok) notify.success("האימות הושלם");
  };

  const copySecret = async () => {
    if (!enrolling) return;
    await Clipboard.setStringAsync(enrolling.secret);
    notify.success("המפתח הועתק");
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="אימות דו-שלבי" showBack onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        {status === "loading" ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <View style={[styles.card, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
            <ShieldCheck size={28} color={theme.primary} />

            {status === "enroll" && !enrolling ? (
              <>
                <Text style={[styles.title, { color: theme.text }]}>
                  פאנל הניהול דורש אימות דו-שלבי
                </Text>
                <Text style={[styles.body, { color: theme.textMuted }]}>
                  סרוק קוד באפליקציית אימות (Google Authenticator, 1Password וכדומה) פעם אחת,
                  ומכאן והלאה תתבקש להזין קוד רק בכניסה לפאנל.
                </Text>
                <Button title="התחל הגדרה" onPress={startEnrollment} loading={busy} />
              </>
            ) : null}

            {enrolling ? (
              <>
                <Text style={[styles.title, { color: theme.text }]}>סרוק את הקוד</Text>
                <View style={styles.qr}>
                  <QRCodeSVG value={enrolling.uri} size={180} />
                </View>
                <Text selectable style={[styles.secret, { color: theme.textMuted }]}>
                  {enrolling.secret}
                </Text>
                <Button title="העתק מפתח ידני" variant="outline" onPress={copySecret} />
              </>
            ) : null}

            {status === "challenge" || enrolling ? (
              <>
                <Text style={[styles.body, { color: theme.textMuted }]}>
                  הזן את הקוד בן 6 הספרות מהאפליקציה
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.codeInput,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg },
                  ]}
                />
                <Button title="אמת" onPress={submit} loading={busy} />
                {enrolling ? (
                  <Button title="ביטול" variant="outline" onPress={cancelEnrollment} />
                ) : null}
              </>
            ) : null}

            {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16 },
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 20,
    gap: 14,
    alignItems: "center",
  },
  title: { fontFamily: fonts.bodyBold, fontSize: 18, textAlign: "center" },
  body: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", lineHeight: 21 },
  qr: { backgroundColor: "#ffffff", padding: 12, borderRadius: radii.md },
  secret: { fontFamily: fonts.body, fontSize: 13, letterSpacing: 1, textAlign: "center" },
  codeInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 12,
    fontSize: 22,
    letterSpacing: 6,
    textAlign: "center",
  },
  error: { fontFamily: fonts.body, fontSize: 13, textAlign: "center" },
});
