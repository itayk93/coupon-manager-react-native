import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { referralCodeFromPath } from "@/lib/referral";
import { claimPendingReferral, savePendingReferral } from "@/lib/referralClaim";
import { fonts } from "@/lib/theme";

/**
 * Where an invite link lands.
 *
 * The screen itself does almost nothing on purpose: someone who tapped a
 * friend's link wants the app, not a page about referrals. It writes the code
 * down, hands the person straight to registration, and gets out of the way.
 *
 * Public by necessity — the whole point is that the visitor has no account
 * yet. Nothing here is worth anything on its own: a code identifies a chain,
 * and only a real registration on the server turns it into an attribution.
 */
export function ReferralLandingScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const [message, setMessage] = useState<string | null>(null);
  // The redirect must fire once. Re-running it on a re-render pushes a second
  // screen onto the stack and the back button stops working.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const raw = Array.isArray(params.code) ? params.code[0] : params.code;
    const code = referralCodeFromPath(raw);

    (async () => {
      if (!code) {
        setMessage("הקישור אינו תקין");
        setTimeout(() => router.replace(session ? "/(tabs)" : "/(auth)/register"), 1200);
        return;
      }

      await savePendingReferral(code);
      // An existing account that opened someone's link is still worth a try:
      // the server refuses it unless they registered in the last two weeks and
      // have not been attributed already.
      if (session) await claimPendingReferral();

      router.replace(session ? "/(tabs)" : "/(auth)/register");
    })();
  }, [params, router, session]);


  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.text, { color: theme.text }]}>
          {message ?? "רק רגע, פותחים לך את קופון מאסטר…"}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  text: { fontFamily: fonts.body, fontSize: 16, textAlign: "center" },
});
