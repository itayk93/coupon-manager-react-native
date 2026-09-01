import type { ParsedCoupon } from "@/hooks/useCouponAI";

const imports = new Map<string, ParsedCoupon>();

/** Keeps parsed coupon details out of navigation URLs, including CVV/card expiry. */
export function storeSharedCouponImport(id: string, coupon: ParsedCoupon): void {
  imports.clear();
  imports.set(id, coupon);
}

export function getSharedCouponImport(id: string | undefined): ParsedCoupon | null {
  return id ? imports.get(id) ?? null : null;
}
