import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CouponUsage } from '@/integrations/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Full usage history for a single coupon (timeline)
export function useCouponUsageHistory(couponId: number | undefined) {
  return useQuery({
    queryKey: ['coupon_usage', couponId],
    queryFn: async () => {
      if (!couponId) return [];
      const { data, error } = await supabase
        .from('coupon_usage')
        .select('*')
        .eq('coupon_id', couponId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data as CouponUsage[];
    },
    enabled: !!couponId,
  });
}

// Record a usage event AND bump the coupon's used_value / status.
export function useRecordUsage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      couponId,
      usedAmount,
      details,
    }: {
      couponId: number;
      usedAmount: number;
      details?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Fetch current coupon to compute new used_value and status
      const { data: coupon, error: fetchErr } = await supabase
        .from('coupon')
        .select('id, value, used_value')
        .eq('id', couponId)
        .eq('user_id', user.id)
        .single();
      if (fetchErr) throw fetchErr;

      const newUsed = Math.min(coupon.value, (coupon.used_value || 0) + usedAmount);
      const fullyUsed = newUsed >= coupon.value;

      const { error: usageErr } = await supabase.from('coupon_usage').insert({
        coupon_id: couponId,
        used_amount: usedAmount,
        action: 'usage',
        details: details || null,
        timestamp: new Date().toISOString(),
      });
      if (usageErr) throw usageErr;

      const { error: updateErr } = await supabase
        .from('coupon')
        .update({ used_value: newUsed, status: fullyUsed ? 'נוצל' : 'פעיל' })
        .eq('id', couponId)
        .eq('user_id', user.id);
      if (updateErr) throw updateErr;

      return { newUsed, fullyUsed };
    },
    onSuccess: (_data, variables) => {
      toast.success('השימוש נרשם בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['coupon_usage', variables.couponId] });
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      queryClient.invalidateQueries({ queryKey: ['coupon', variables.couponId] });
    },
    onError: (error: any) => {
      toast.error(`שגיאה ברישום השימוש: ${error.message}`);
    },
  });
}
