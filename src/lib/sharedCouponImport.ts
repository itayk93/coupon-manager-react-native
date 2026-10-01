import type { ParsedCoupon } from "@/hooks/useCouponAI";

const imports = new Map<string, ParsedCoupon[]>();

/**
 * Keeps parsed coupon details out of navigation URLs, including CVV/card expiry.
 * A message can carry several coupons; they are kept as one ordered batch so
 * the add screen can walk the user through them one at a time.
 */
export function storeSharedCouponImport(id: string, coupons: ParsedCoupon | ParsedCoupon[]): void {
  imports.clear();
  imports.set(id, Array.isArray(coupons) ? coupons : [coupons]);
}

export function getSharedCouponImport(id: string | undefined, index = 0): ParsedCoupon | null {
  return id ? imports.get(id)?.[index] ?? null : null;
}

export function getSharedCouponImportCount(id: string | undefined): number {
  return id ? imports.get(id)?.length ?? 0 : 0;
}
