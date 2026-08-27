import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { supabase } from "@/integrations/supabase/client";
import {
  isPendingReferralFresh,
  normalizeReferralCode,
  type PendingReferral,
} from "@/lib/referral";

/**
 * The device half of referral attribution: hold the code from the link until
 * there is an account to attach it to, then hand it to the server once.
 *
 * Everything here is best-effort and silent. A referral is worth money to a
 * partner and nothing to the person registering, so it must never be the
 * reason a sign-up shows an error or takes a second longer.
 */

const PENDING_KEY = "referral:pending";
const INSTALL_KEY = "referral:install_id";
const CLAIMED_KEY = "referral:claimed";

export async function savePendingReferral(rawCode: unknown): Promise<boolean> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return false;
  try {
    // Deliberately overwrites: the most recent link someone actually tapped is
    // the best guess at who brought them. The server still enforces that only
    // the first *claim* counts, so this cannot re-point an existing account.
    const pending: PendingReferral = { code, savedAt: Date.now() };
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

async function readPendingReferral(): Promise<PendingReferral | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingReferral;
    return normalizeReferralCode(parsed?.code) && typeof parsed?.savedAt === "number"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/**
 * A random id minted on first launch and kept for the life of the install.
 *
 * Not a device id — the platforms stopped handing those out, for good reasons.
 * Deleting the app resets it, which is exactly why the server treats a repeat
 * as a flag for a human to look at and never as an automatic rejection. Only
 * its hash is ever sent.
 */
async function installId(): Promise<string | null> {
  try {
    const existing = await AsyncStorage.getItem(INSTALL_KEY);
    if (existing) return existing;
    const fresh = randomUUID();
    await AsyncStorage.setItem(INSTALL_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/**
 * Attach the signed-in account to whatever chain its link came from.
 *
 * Called after the account exists, not at sign-up: with email verification the
 * row in `users` may not be there yet, and Google sign-in never passes through
 * the registration screen at all. Safe to call on every launch — the server
 * locks attribution to the first claim, and the local marker keeps it to one
 * request per install regardless.
 */
export async function claimPendingReferral(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(CLAIMED_KEY)) return;

    const pending = await readPendingReferral();
    if (!isPendingReferralFresh(pending, Date.now())) {
      if (pending) await AsyncStorage.removeItem(PENDING_KEY);
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const { data, error } = await supabase.functions.invoke("claim-referral", {
      body: { code: pending!.code, install_id: await installId() },
    });
    if (error) return; // Offline or a bad gateway: the code stays for next launch.

    // Anything but a transport failure is final. Retrying an invalid code or a
    // second claim on every launch would be a request per app open, forever.
    await AsyncStorage.multiSet([
      [CLAIMED_KEY, String(data?.status ?? "unknown")],
      [PENDING_KEY, ""],
    ]);
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // Attribution is not worth an error in front of someone signing up.
  }
}

/** Sign-out clears the marker so the next account on this phone can claim. */
export async function resetReferralClaim(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLAIMED_KEY);
  } catch {
    // Nothing to do; the server refuses a second claim anyway.
  }
}
