import { supabase } from '@/integrations/supabase/client';

function isUnauthenticated(error: unknown): boolean {
  const status = (error as any)?.context?.status ?? (error as any)?.status;
  return status === 401 || status === 403;
}

/**
 * Calls the vault, and retries once behind a token refresh.
 *
 * An access token that expired while the tab was open makes every vault call
 * fail with 401. Without the retry the wallet renders empty and logged in at
 * the same time, which reads as lost data rather than as a stale session.
 */
export async function couponVault<T>(body: Record<string, unknown>): Promise<T> {
  let { data, error } = await supabase.functions.invoke('coupon-vault', { body });

  if (error && isUnauthenticated(error)) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (!refreshed.session) {
      // The refresh token is gone too, so nothing here can recover: drop the
      // session and let the auth guard send the user to the login screen.
      await supabase.auth.signOut();
      throw new Error('הפעלת ההתחברות פגה. יש להתחבר מחדש.');
    }
    ({ data, error } = await supabase.functions.invoke('coupon-vault', { body }));
  }

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.data as T;
}
