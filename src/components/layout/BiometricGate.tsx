import React from "react";
import { AppState, Platform, Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";

/**
 * Face ID / Touch ID lock over the signed-in app.
 *
 * The stored Supabase session is what keeps the user signed in; biometrics gate
 * access to it. No password is ever stored, so this adds a lock without adding
 * a new secret to steal.
 *
 * The OS owns the biometric prompt on both iOS and Android, so this component
 * deliberately renders nothing but a blocking scrim and lets the system sheet
 * be the whole experience. Tapping the scrim re-triggers the prompt.
 */
export function BiometricGate() {
  const { session } = useAuth();
  const { theme } = useAppTheme();
  const { isAvailable, isEnabled, label, authenticate } = useBiometricAuth();

  const shouldLock = Boolean(session) && isEnabled && isAvailable && Platform.OS !== "web";

  const [unlocked, setUnlocked] = React.useState(false);
  const [prompting, setPrompting] = React.useState(false);

  const runPrompt = React.useCallback(async () => {
    if (prompting) return;
    setPrompting(true);
    try {
      const ok = await authenticate(`אמת את זהותך עם ${label} כדי להמשיך`);
      if (ok) setUnlocked(true);
    } finally {
      setPrompting(false);
    }
  }, [authenticate, label, prompting]);

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

  return (
    <Pressable
      onPress={runPrompt}
      accessibilityRole="button"
      accessibilityLabel={`פתיחה עם ${label}`}
      style={[styles.root, { backgroundColor: theme.background }]}
    >
      <View />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 9998,
  },
});
