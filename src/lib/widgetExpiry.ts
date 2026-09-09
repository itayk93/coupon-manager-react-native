/** Date-only vouchers expire at the end of their local calendar day. */
export function expiringWidgetCoupons<T extends { id: number; expiration?: string | null }>(
  coupons: T[], now = new Date(),
): { coupon: T; days: number }[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return coupons.flatMap((coupon) => {
    if (!coupon.expiration) return [];
    const raw = coupon.expiration;
    const end = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59.999` : raw);
    if (!Number.isFinite(end.getTime()) || end.getTime() <= now.getTime()) return [];
    const day = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    const days = Math.round((day - today) / 86400000);
    return days >= 0 && days <= 7 ? [{ coupon, days, deadline: end.getTime() }] : [];
  }).sort((a, b) => a.deadline - b.deadline || a.coupon.id - b.coupon.id)
    .map(({ coupon, days }) => ({ coupon, days }));
}
