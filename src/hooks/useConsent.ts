import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { couponVault } from '@/lib/couponVault';
import { notify } from '@/lib/notify';
import { OPT_OUTS_COLUMNS } from '@/lib/tableColumns';
import { CONSENT_VERSION } from '@/lib/consent';

export { CONSENT_VERSION };

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
      notify.success(optedOut ? 'ביטלת קבלת דיוור' : 'הצטרפת חזרה לדיוור');
      queryClient.invalidateQueries({ queryKey: ['opt_out'] });
    },
    onError: (e: any) => notify.error('שגיאה', e.message),
  });
}

// Record a privacy-policy consent event (audit row + version stamp on the user).
export function useRecordConsent() {
  return useMutation({
    mutationFn: async (version: string = CONSENT_VERSION) => {
      await couponVault({ action: 'record_consent', version });
    },
  });
}

// GDPR art. 15 + 20 / חוק הגנת הפרטיות ס' 13 — hand the user everything the
// account holds as one JSON file, through the OS share sheet.
export function useExportAccount() {
  return useMutation({
    mutationFn: async () => {
      const data = await couponVault<Record<string, unknown>>({ action: 'export_account' });
      const json = JSON.stringify(data, null, 2);
      const file = new File(Paths.cache, `coupon-master-data-${Date.now()}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'המידע שלי',
          UTI: 'public.json',
        });
      }
      return file.uri;
    },
    onError: (e: any) => notify.error('שגיאה בהורדת המידע', e.message),
  });
}

// GDPR "right to be forgotten" / חוק הגנת הפרטיות ס' 14 — immediate, complete
// erasure across every table plus the auth identity (delete_account_data).
export function useDeleteAccount() {
  const { signOut } = useAuth();
  return useMutation({
    mutationFn: async () => {
      await couponVault({ action: 'delete_account' });
    },
    onSuccess: async () => {
      notify.success('החשבון וכל הנתונים נמחקו');
      await signOut();
    },
    onError: (e: any) => notify.error('שגיאה במחיקת החשבון', e.message),
  });
}
