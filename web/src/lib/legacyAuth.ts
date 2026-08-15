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

export function getStoredLegacyUser(): LegacyUser | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as LegacyUser;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function storeLegacyUser(user: LegacyUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearLegacyUser() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Verifies credentials on the server and establishes a real Supabase session.
 *
 * The password hash is never sent to the browser: the legacy-login Edge
 * Function checks it with the service role and returns a one-time token, which
 * we exchange for a session. Every subsequent PostgREST request then carries a
 * signed JWT, which is what the RLS policies key off.
 */
export async function signInLegacy(email: string, password: string): Promise<LegacyUser> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.functions.invoke("legacy-login", {
    body: { email: normalizedEmail, password },
  });

  if (error) {
    // Edge Function errors arrive as a generic FunctionsHttpError; the useful
    // message is in the response body.
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? "ההתחברות נכשלה. נסה שוב.");
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.token_hash) throw new Error("ההתחברות נכשלה. נסה שוב.");

  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: data.token_hash,
  });
  if (otpError) throw new Error("ההתחברות נכשלה. נסה שוב.");

  storeLegacyUser(data.user as LegacyUser);
  return data.user as LegacyUser;
}
