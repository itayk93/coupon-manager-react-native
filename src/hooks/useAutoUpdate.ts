import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Triggers the `update-balance` Edge Function that re-scrapes the live balance of
// auto-updatable coupons (Multipass / BuyMe) for the current user.
export function useTriggerAutoUpdate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (couponId?: number) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('update-balance', {
        body: { user_id: user.id, coupon_id: couponId ?? null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { updated: number; failed: number; skipped: number };
    },
    onSuccess: (result) => {
      toast.success(`עדכון הסתיים: ${result.updated} עודכנו, ${result.failed} נכשלו`);
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      queryClient.invalidateQueries({ queryKey: ['auto_update_runs'] });
    },
    onError: (error: any) => {
      toast.error(`שגיאה בעדכון היתרה: ${error.message}`);
    },
  });
}
