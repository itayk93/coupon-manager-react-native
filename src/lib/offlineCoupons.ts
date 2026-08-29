import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { isSpendableCoupon } from "@/lib/couponTotals";

const KEY = "offline:coupons:v1";

export type OfflineWalletStatus = { usingCache: boolean; savedAt: number | null };
let offlineStatus: OfflineWalletStatus = { usingCache: false, savedAt: null };
const offlineListeners = new Set<() => void>();

export function subscribeOfflineWallet(listener: () => void): () => void {
  offlineListeners.add(listener);
  return () => offlineListeners.delete(listener);
}

export function getOfflineWalletStatus(): OfflineWalletStatus {
  return offlineStatus;
}

function setOfflineStatus(next: OfflineWalletStatus) {
  offlineStatus = next;
  offlineListeners.forEach((listener) => listener());
}

/**
 * Hard ceiling on what the wallet mirror may occupy on the device.
 *
 * A coupon serialises to roughly 400-600 bytes, so this holds close to a
 * thousand of them — far past any real wallet — while guaranteeing the cache
 * can never become the reason the phone runs out of room. Anything over the
 * budget is dropped rather than stored, newest-and-most-useful first.
 */
const MAX_BYTES = 512 * 1024;

type Snapshot = {
  userId: string | number;
  savedAt: number;
  coupons: DecryptedCoupon[];
};

/** A snapshot older than this is treated as absent — prices and balances go stale. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Most-worth-keeping first: coupons that can still be spent, then the ones
 * expiring soonest. When the budget forces a trim, what survives is what the
 * user would actually have opened the app to see.
 */
function byUsefulness(a: DecryptedCoupon, b: DecryptedCoupon): number {
  const spendable = Number(isSpendableCoupon(b)) - Number(isSpendableCoupon(a));
  if (spendable !== 0) return spendable;
  const aExp = a.expiration ? Date.parse(a.expiration) : Number.POSITIVE_INFINITY;
  const bExp = b.expiration ? Date.parse(b.expiration) : Number.POSITIVE_INFINITY;
  return aExp - bExp;
}

/** Largest prefix of `coupons` whose serialised snapshot fits the budget. */
function fitToBudget(snapshot: Snapshot): string {
  const ordered = [...snapshot.coupons].sort(byUsefulness);
  let payload = JSON.stringify({ ...snapshot, coupons: ordered });
  // Shrinking by a fifth at a time converges in a handful of passes even for an
  // absurd wallet, without the cost of re-serialising once per dropped coupon.
  while (payload.length > MAX_BYTES && ordered.length > 0) {
    ordered.length = Math.max(0, Math.floor(ordered.length * 0.8));
    payload = JSON.stringify({ ...snapshot, coupons: ordered });
  }
  return payload;
}

/**
 * Mirrors the wallet to disk so it survives a cold start with no connection.
 *
 * Never throws: a failed write means the next launch falls back to the network,
 * which is exactly where the app was before this cache existed.
 */
export async function saveOfflineCoupons(
  userId: string | number,
  coupons: DecryptedCoupon[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, fitToBudget({ userId, savedAt: Date.now(), coupons }));
    setOfflineStatus({ usingCache: false, savedAt: Date.now() });
  } catch {
    // Storage full or unavailable — the mirror is an optimisation, not a store.
  }
}

/** The mirrored wallet, or null when it is missing, stale, or another user's. */
export async function loadOfflineCoupons(
  userId: string | number,
): Promise<DecryptedCoupon[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Snapshot;
    if (String(snapshot.userId) !== String(userId)) return null;
    if (Date.now() - snapshot.savedAt > MAX_AGE_MS) return null;
    if (!Array.isArray(snapshot.coupons)) return null;
    setOfflineStatus({ usingCache: true, savedAt: snapshot.savedAt });
    return snapshot.coupons;
  } catch {
    return null;
  }
}

/**
 * Drops the mirror. Called on sign-out: coupon codes and CVVs are in it, and
 * they have no business outliving the session that fetched them.
 */
export async function clearOfflineCoupons(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
    setOfflineStatus({ usingCache: false, savedAt: null });
  } catch {
    // Nothing useful to do — the next sign-in overwrites it anyway.
  }
}
