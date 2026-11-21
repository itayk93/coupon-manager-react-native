/** Informed, account-scoped permission. Never infer this from terms acceptance. */
export const AI_CONSENT_KEY = 'coupon_ai_consent';
export const AI_CONSENT_VERSION = 'coupon-openai-v1';
export function hasAiConsent(user: {user_metadata?: Record<string, any>} | null | undefined): boolean {
  const c = user?.user_metadata?.[AI_CONSENT_KEY];
  return c?.granted === true && c.version === AI_CONSENT_VERSION && c.provider === 'openai' && typeof c.updatedAt === 'string' && Number.isFinite(Date.parse(c.updatedAt));
}
export function aiConsentRecord(granted: boolean, now = new Date()) {
  return {granted, version: AI_CONSENT_VERSION, provider: 'openai', updatedAt: now.toISOString()};
}
