import { entityPublicId, type EntityIdentity } from "./entityId";

export type CouponIdentity = EntityIdentity;

/** Public route token, with numeric fallback for rows cached before migration. */
export const couponRouteId = entityPublicId;
