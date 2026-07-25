import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DecryptedCoupon } from './useCoupons';

export type ConsolidatedRow = {
  id: number | string;
  coupon_id: number;
  timestamp: string | null;
  transaction_amount: number;
  details: string;
  source_table: 'coupon_usage' | 'coupon_transaction' | 'sum_row';
};

// Full usage & transaction history for a single coupon (consolidating coupon_usage & coupon_transaction + fallback & summary row)
export function useCouponUsageHistory(coupon: DecryptedCoupon | null) {
  return useQuery({
    queryKey: ['coupon_usage', coupon?.id],
    queryFn: async (): Promise<ConsolidatedRow[]> => {
      if (!coupon) return [];

      const couponId = coupon.id;

      // Fetch from coupon_usage
      const { data: usageData } = await supabase
        .from('coupon_usage')
        .select('*')
        .eq('coupon_id', couponId);

      // Fetch from coupon_transaction
      const { data: txData } = await supabase
        .from('coupon_transaction')
        .select('*')
        .eq('coupon_id', couponId);

      const rows: ConsolidatedRow[] = [];

      // Map coupon_usage
      (usageData || []).forEach((u) => {
        rows.push({
          id: u.id,
          coupon_id: u.coupon_id,
          timestamp: u.timestamp,
          transaction_amount: -Math.abs(u.used_amount), // negative for usage
          details: u.details || u.action || 'שימוש בקופון',
          source_table: 'coupon_usage',
        });
      });

      // Map coupon_transaction
      (txData || []).forEach((t) => {
        const usage = t.usage_amount || 0;
        const recharge = t.recharge_amount || 0;
        const amount = recharge - usage;
        rows.push({
          id: t.id,
          coupon_id: t.coupon_id,
          timestamp: t.transaction_date || new Date().toISOString(),
          transaction_amount: amount,
          details: t.location || t.source || 'עסקת קופון',
          source_table: 'coupon_transaction',
        });
      });

      // Fallback: If no records exist in either table, construct initial synthesized history from coupon fields
      if (rows.length === 0) {
        if (coupon.value > 0) {
          rows.push({
            id: `init-charge-${coupon.id}`,
            coupon_id: coupon.id,
            timestamp: coupon.date_added || new Date().toISOString(),
            transaction_amount: coupon.value,
            details: 'טעינה ראשונית / יצירת קופון',
            source_table: 'coupon_transaction',
          });
        }
        if (coupon.used_value > 0) {
          rows.push({
            id: `init-usage-${coupon.id}`,
            coupon_id: coupon.id,
            timestamp: coupon.date_added || new Date().toISOString(),
            transaction_amount: -coupon.used_value,
            details: 'שימוש בקופון',
            source_table: 'coupon_usage',
          });
        }
      }

      // Sort rows descending by timestamp (nulls last)
      rows.sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      // Calculate summary / remaining balance row
      const remainingBalance = Math.max(0, coupon.value - coupon.used_value);
      rows.push({
        id: `sum-${coupon.id}`,
        coupon_id: coupon.id,
        timestamp: null,
        transaction_amount: remainingBalance,
        details: 'סה״כ יתרה בקופון',
        source_table: 'sum_row',
      });

      return rows;
    },
    enabled: !!coupon,
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

// Delete a transaction record from coupon_usage or coupon_transaction
export function useDeleteTransactionRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordId,
      sourceTable,
      couponId,
    }: {
      recordId: number | string;
      sourceTable: 'coupon_usage' | 'coupon_transaction' | 'sum_row';
      couponId: number;
    }) => {
      if (typeof recordId === 'string') return { couponId }; // synthetic fallback row

      if (sourceTable === 'coupon_usage') {
        const { error } = await supabase.from('coupon_usage').delete().eq('id', recordId);
        if (error) throw error;
      } else if (sourceTable === 'coupon_transaction') {
        const { error } = await supabase.from('coupon_transaction').delete().eq('id', recordId);
        if (error) throw error;
      }
      return { couponId };
    },
    onSuccess: (_data, variables) => {
      toast.success('הרשומה נמחקה בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['coupon_usage', variables.couponId] });
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      queryClient.invalidateQueries({ queryKey: ['coupon', variables.couponId] });
    },
    onError: (error: any) => {
      toast.error(`שגיאה במחיקת הרשומה: ${error.message}`);
    },
  });
}
