import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const ENABLED_KEY = "coupon_master_biometric_enabled";
const EMAIL_KEY = "coupon_master_biometric_email";

export type BiometricKind = "face" | "fingerprint" | "iris" | "none";

/**
 * Face ID / Touch ID unlock.
 *
 * Deliberately does NOT store the password. Biometrics only re-authorise a
 * session that Supabase already persisted, so a stolen device with an unlocked
 * keychain cannot yield a password, and a signed-out user still has to type
 * their credentials once.
 */
export function useBiometricAuth() {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [kind, setKind] = useState<BiometricKind>("none");
  const [isEnabled, setIsEnabled] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      if (Platform.OS === "web") return;

      const [hardware, enrolled, types, enabledFlag, email] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
        AsyncStorage.getItem(ENABLED_KEY),
        AsyncStorage.getItem(EMAIL_KEY),
      ]);

      if (!active) return;

      setIsSupported(hardware);
      setIsEnrolled(enrolled);
      setIsEnabled(enabledFlag === "true");
      setSavedEmail(email);

      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setKind("face");
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setKind("fingerprint");
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setKind("iris");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const label =
    kind === "face" ? "זיהוי פנים" : kind === "fingerprint" ? "טביעת אצבע" : "זיהוי ביומטרי";

  /** Prompt for biometrics. Resolves true only on a successful match. */
  const authenticate = useCallback(
    async (reason = "התחברות לקופון מאסטר") => {
      if (Platform.OS === "web") return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: "ביטול",
        // Falling back to the device passcode keeps the user unblocked when a
        // face/finger read fails repeatedly.
        disableDeviceFallback: false,
      });

      return result.success;
    },
    []
  );

  const enable = useCallback(async (email: string) => {
    await AsyncStorage.multiSet([
      [ENABLED_KEY, "true"],
      [EMAIL_KEY, email],
    ]);
    setIsEnabled(true);
    setSavedEmail(email);
  }, []);

  const disable = useCallback(async () => {
    await AsyncStorage.multiRemove([ENABLED_KEY, EMAIL_KEY]);
    setIsEnabled(false);
    setSavedEmail(null);
  }, []);

  return {
    /** Device has the hardware and the user has enrolled a face/finger. */
    isAvailable: isSupported && isEnrolled,
    isSupported,
    isEnrolled,
    isEnabled,
    savedEmail,
    kind,
    label,
    authenticate,
    enable,
    disable,
  };
}
