export const BIOMETRIC_BACKGROUND_GRACE_MS = 10 * 60 * 1000;

export function shouldRelockAfterBackground(
  backgroundedAt: number | null,
  resumedAt: number,
  graceMs = BIOMETRIC_BACKGROUND_GRACE_MS
) {
  if (backgroundedAt === null) return false;
  return resumedAt - backgroundedAt >= graceMs;
}
