import React from "react";
import { AppState, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Fingerprint, ScanFace } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { fonts, palette, radii } from "@/lib/theme";

/**
 * Face ID / Touch ID lock over the signed-in app.
 *
 * The stored Supabase session is what keeps the user signed in; biometrics gate
 * access to it. No password is ever stored, so this adds a lock without adding
 * a new secret to steal.
 */
export function BiometricGate() {
  const { session } = useAuth();
  const { theme } = useAppTheme();
  const { isAvailable, isEnabled, kind, label, authenticate } = useBiometricAuth();

  const shouldLock = Boolean(session) && isEnabled && isAvailable && Platform.OS !== "web";

  const [unlocked, setUnlocked] = React.useState(false);
  const [prompting, setPrompting] = React.useState(false);

  const runPrompt = React.useCallback(async () => {
    if (prompting) return;
    setPrompting(true);
    try {
      const ok = await authenticate();
      if (ok) setUnlocked(true);
    } finally {
      setPrompting(false);
    }
  }, [authenticate, prompting]);

  // Prompt as soon as the lock becomes relevant.
  React.useEffect(() => {
    if (shouldLock && !unlocked) void runPrompt();
    // runPrompt is intentionally omitted: re-running on its identity would
    // re-open the system dialog while it is already on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLock, unlocked]);

  // Re-lock when the app goes to the background.
  React.useEffect(() => {
    if (!shouldLock) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") setUnlocked(false);
    });
    return () => sub.remove();
  }, [shouldLock]);

  // Signing out clears the lock so the next sign-in starts fresh.
  React.useEffect(() => {
    if (!session) setUnlocked(false);
  }, [session]);

  if (!shouldLock || unlocked) return null;

  const Icon = kind === "fingerprint" ? Fingerprint : ScanFace;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[palette.primary, palette.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.mark}
      >
        <Icon size={34} color="#ffffff" strokeWidth={1.7} />
      </LinearGradient>

      <Text style={[styles.title, { color: theme.text }]}>הארנק נעול</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        אמת את זהותך עם {label} כדי להמשיך
      </Text>

      <TouchableOpacity activeOpacity={0.85} onPress={runPrompt} disabled={prompting}>
        <LinearGradient
          colors={[palette.primary, palette.primaryDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            {prompting ? "ממתין לאימות..." : `פתיחה עם ${label}`}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 9998,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  mark: {
    width: 76,
    height: 76,
    borderRadius: radii.hero,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 18,
  },
  button: {
    height: 48,
    paddingHorizontal: 28,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: fonts.bodyBold,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
