import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Mirrors the legacy app's view timestamps used by the automatic balance updater. */
export function useCouponViewTracking() {
  const { user } = useAuth();

  const markDetailViewed = useCallback(async (couponId: number) => {
    if (!user) return;
    await supabase.from('coupon').update({ last_detail_view: new Date().toISOString() }).eq('id', couponId).eq('user_id', user.id);
  }, [user]);

  const markCodeViewed = useCallback(async (couponId: number) => {
    if (!user) return;
    await supabase.from('coupon').update({ last_code_view: new Date().toISOString() }).eq('id', couponId).eq('user_id', user.id);
  }, [user]);

  const markCompanyViewed = useCallback(async (company: string) => {
    if (!user || !company) return;
    await supabase.from('coupon').update({ last_company_view: new Date().toISOString() }).eq('company', company).eq('user_id', user.id);
  }, [user]);

  return { markDetailViewed, markCodeViewed, markCompanyViewed };
}
