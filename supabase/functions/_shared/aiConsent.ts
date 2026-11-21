/** This record is read from Supabase Auth, never supplied by the request body. */
export function hasAiConsent(user: {user_metadata?: Record<string, any>} | null | undefined): boolean {
  const c = user?.user_metadata?.coupon_ai_consent;
  return c?.granted === true && c.version === 'coupon-openai-v1' && c.provider === 'openai' && typeof c.updatedAt === 'string' && Number.isFinite(Date.parse(c.updatedAt));
}
/** No cache: revocation must apply to the next scheduled notification too. */
export async function backgroundAiAllowed(supabase: any, userId: number | undefined): Promise<boolean> {
  if (!supabase || !userId) return false;
  try {
    const {data:profile,error} = await supabase.from('users').select('auth_user_id,is_deleted').eq('id',userId).maybeSingle();
    if (error || !profile?.auth_user_id || profile.is_deleted) return false;
    const {data,error:authError} = await supabase.auth.admin.getUserById(profile.auth_user_id);
    return !authError && hasAiConsent(data?.user);
  } catch { return false; }
}
