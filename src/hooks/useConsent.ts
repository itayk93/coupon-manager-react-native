import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { OPT_OUTS_COLUMNS } from '@/lib/tableColumns';

export const CONSENT_VERSION = '1.0';

// Whether the current user has an active opt-out (marketing)
export function useOptOut() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['opt_out', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('opt_outs')
        .select(OPT_OUTS_COLUMNS)
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });
}

export function useSetOptOut() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (optedOut: boolean) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('opt_outs').upsert(
        { user_id: user.id, opted_out: optedOut, timestamp: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
    },
    onSuccess: (_d, optedOut) => {
      toast.success(optedOut ? 'ביטלת קבלת דיוור' : 'הצטרפת חזרה לדיוור');
      queryClient.invalidateQueries({ queryKey: ['opt_out'] });
    },
    onError: (e: any) => toast.error(`שגיאה: ${e.message}`),
  });
}

// Record a GDPR consent event
export function useRecordConsent() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (consentStatus: boolean) => {
      const { error } = await supabase.from('user_consents').insert({
        user_id: user?.id ?? null,
        consent_status: consentStatus,
        version: CONSENT_VERSION,
        timestamp: new Date().toISOString(),
      });
      if (error) throw error;
    },
  });
}

// GDPR "right to be forgotten": soft-delete the account and wipe personal data.
export function useDeleteAccount() {
  const { user, signOut } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Delete the user's coupons and related rows, then soft-delete the user record.
      await supabase.from('coupon').delete().eq('user_id', user.id);
      await supabase.from('notifications').delete().eq('user_id', user.id);
      await supabase.from('user_activities').delete().eq('user_id', user.id);
      await supabase
        .from('users')
        .update({
          is_deleted: true,
          email: `deleted_${user.id}@deleted.local`,
          first_name: 'משתמש',
          last_name: 'מחוק',
          profile_description: null,
          profile_image: null,
        })
        .eq('id', user.id);
    },
    onSuccess: async () => {
      toast.success('החשבון והנתונים נמחקו');
      await signOut();
    },
    onError: (e: any) => toast.error(`שגיאה במחיקת החשבון: ${e.message}`),
  });
}
