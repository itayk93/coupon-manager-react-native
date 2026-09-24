/**
 * Merging one coupon the vault returned into the cached wallet list, so a
 * single add or edit does not refetch and re-decrypt every coupon.
 *
 * Kept free of React Query so the rules can be tested on their own.
 */
export type WalletCoupon = {
  id: number;
  status?: string | null;
  deleted_at?: string | null;
  is_shared_with_me?: boolean;
};

/** The vault's list leaves out sold and trashed coupons; the cache must too. */
export function belongsInWallet(coupon: WalletCoupon): boolean {
  return coupon.status !== "נמכר" && !coupon.deleted_at;
}

/**
 * The wallet with `coupon` in place of its old copy, at the top when new, or
 * gone when it no longer belongs there. The cached "shared with me" flag wins,
 * since the vault's create and update answers do not carry it.
 */
export function mergeCouponIntoWallet<T extends WalletCoupon>(current: T[], coupon: T): T[] {
  const exists = current.some((c) => c.id === coupon.id);
  if (!belongsInWallet(coupon)) return exists ? current.filter((c) => c.id !== coupon.id) : current;
  if (!exists) return [coupon, ...current];
  return current.map((c) =>
    c.id === coupon.id ? { ...coupon, is_shared_with_me: c.is_shared_with_me ?? coupon.is_shared_with_me } : c
  );
}
