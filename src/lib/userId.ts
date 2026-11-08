import { entityPublicId, type EntityIdentity } from "./entityId";

export type UserIdentity = EntityIdentity;

/** Opaque API identity, with numeric fallback for pre-rollout cached sessions. */
export const publicUserId = entityPublicId;
