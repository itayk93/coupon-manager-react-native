export type EntityIdentity = {
  id: number;
  public_id?: string | null;
};

export type CouponIdentity = EntityIdentity;
export type UserIdentity = EntityIdentity;

/** Public route or API token, with numeric fallback for rows/sessions cached before migration. */
export function entityPublicId(entity: EntityIdentity): string {
  return entity.public_id || String(entity.id);
}

export const couponRouteId = entityPublicId;
export const publicUserId = entityPublicId;

