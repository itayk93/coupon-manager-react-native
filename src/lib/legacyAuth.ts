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

async function getAppUser(authUserId: string, email: string): Promise<LegacyUser> {
  const { data: linkedUser, error: linkedError } = await supabase
    .from("users")
    .select("id,email,first_name,last_name,is_admin,is_confirmed,is_deleted")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (linkedError) throw linkedError;
  let data = linkedUser;
  if (!data) {
    const { data: emailUser, error: emailError } = await supabase
      .from("users")
      .select("id,email,first_name,last_name,is_admin,is_confirmed,is_deleted")
      .eq("email", email)
      .maybeSingle();
    if (emailError) throw emailError;
    data = emailUser;
  }
  if (!data || data.is_deleted) throw new Error("המשתמש הזה נמחק או נחסם.");

  return {
    id: data.id,
    email: data.email,
    first_name: data.first_name,
    last_name: data.last_name,
    is_admin: Boolean(data.is_admin),
    is_confirmed: Boolean(data.is_confirmed),
  };
}

/**
 * Verifies credentials on the server and establishes a real Supabase session.
 */
export async function signInLegacy(email: string, password: string): Promise<LegacyUser> {
  const normalizedEmail = email.trim().toLowerCase();

  // Current accounts use Supabase password auth. Older Werkzeug accounts fall
  // back to the server verifier, which then mints the same Supabase session.
  const { data: passwordData } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (passwordData.user) {
    const user = await getAppUser(passwordData.user.id, normalizedEmail);
    await storeLegacyUser(user);
    return user;
  }

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
