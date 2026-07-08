import { supabase } from "@/integrations/supabase/client";
import { checkWerkzeugPasswordHash } from "@/lib/werkzeug";

export type LegacyUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  is_confirmed: boolean;
};

type LegacyUserRow = LegacyUser & {
  password: string;
  is_deleted?: boolean | null;
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

export async function signInLegacy(email: string, password: string): Promise<LegacyUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("users")
    .select("id,email,password,first_name,last_name,is_admin,is_confirmed,is_deleted")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("אימייל או סיסמה שגויים.");

  const userRow = data as LegacyUserRow;
  if (userRow.is_deleted) throw new Error("המשתמש הזה נמחק או נחסם.");
  if (!userRow.is_confirmed) throw new Error("עליך לאשר את חשבונך לפני התחברות.");
  if (!userRow.password) throw new Error("לחשבון הזה אין סיסמה מקומית. נסה להתחבר עם Google.");

  const passwordMatches = await checkWerkzeugPasswordHash(userRow.password, password);
  if (!passwordMatches) throw new Error("אימייל או סיסמה שגויים.");

  const legacyUser: LegacyUser = {
    id: userRow.id,
    email: userRow.email,
    first_name: userRow.first_name,
    last_name: userRow.last_name,
    is_admin: Boolean(userRow.is_admin),
    is_confirmed: Boolean(userRow.is_confirmed),
  };

  storeLegacyUser(legacyUser);
  return legacyUser;
}
