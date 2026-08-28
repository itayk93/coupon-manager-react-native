export type UserIdentity = {
  id: number;
  public_id?: string | null;
};

/** Opaque API identity, with numeric fallback for pre-rollout cached sessions. */
export function publicUserId(user: UserIdentity): string {
  return user.public_id || String(user.id);
}
