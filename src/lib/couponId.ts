export type CouponIdentity = {
  id: number;
  public_id?: string | null;
};

/** Public route token, with numeric fallback for rows cached before migration. */
export function couponRouteId(coupon: CouponIdentity): string {
  return coupon.public_id || String(coupon.id);
}
