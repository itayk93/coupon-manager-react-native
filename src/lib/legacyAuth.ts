import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/integrations/supabase/client";

export type LegacyUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  is_confirmed: boolean;
};

const SESSION_KEY = "coupon_master_legacy_session";

export async function getStoredLegacyUser(): Promise<LegacyUser | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LegacyUser;
  } catch {
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export async function storeLegacyUser(user: LegacyUser): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("Error saving user session:", error);
  }
}

export async function clearLegacyUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error("Error clearing user session:", error);
  }
}

/**
 * Verifies credentials on the server and establishes a real Supabase session.
 */
export async function signInLegacy(email: string, password: string): Promise<LegacyUser> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.functions.invoke("legacy-login", {
    body: { email: normalizedEmail, password },
  });

  if (error) {
    const detail = (error as any).context?.json ? await (error as any).context.json().catch(() => null) : null;
    throw new Error(detail?.error ?? error.message ?? "ההתחברות נכשלה. נסה שוב.");
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.token_hash) throw new Error("ההתחברות נכשלה. נסה שוב.");

  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: data.token_hash,
  });
  if (otpError) throw new Error("ההתחברות נכשלה. נסה שוב.");

  await storeLegacyUser(data.user as LegacyUser);
  return data.user as LegacyUser;
}
