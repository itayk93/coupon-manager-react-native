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
      const [{ data: optOut, error: optOutError }, { data: profile, error: profileError }] = await Promise.all([
        supabase.from('opt_outs').select(OPT_OUTS_COLUMNS).eq('user_id', user.id).maybeSingle(),
        supabase.from('users').select('newsletter_subscription').eq('id', user.id).single(),
      ]);
      if (optOutError) throw optOutError;
      if (profileError) throw profileError;
      return {
        ...optOut,
        marketing_enabled: Boolean(profile.newsletter_subscription) && !(optOut?.opted_out ?? false),
      };
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
      const updateOptOut = async () => {
        const { error } = await supabase.from('opt_outs').upsert(
          { user_id: user.id, opted_out: optedOut, timestamp: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
        if (error) throw error;
      };
      const updateSubscription = async () => {
        const consentFields = optedOut
          ? {}
          : {
              marketing_consent_at: new Date().toISOString(),
              marketing_consent_source: 'notification-settings',
              marketing_consent_version: 'marketing-v1',
            };
        const { error } = await supabase.from('users')
          .update({ newsletter_subscription: !optedOut, ...consentFields })
          .eq('id', user.id);
        if (error) throw error;
      };

      // Fail closed: on opt-out, disable sending first. On opt-in, clear the
      // suppression first and enable sending only after that succeeds.
      if (optedOut) {
        await updateSubscription();
        await updateOptOut();
      } else {
        await updateOptOut();
        await updateSubscription();
      }
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

// GDPR art. 15 + 20 / חוק הגנת הפרטיות ס' 13 — provide an account-data copy
// through the OS share sheet. The cache file is destroyed when sharing ends.
export function useExportAccount() {
  return useMutation({
    mutationFn: async () => {
      const data = await couponVault<Record<string, unknown>>({ action: 'export_account' });
      const json = JSON.stringify(data, null, 2);
      const file = new File(Paths.cache, `coupon-master-data-${Date.now()}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      try {
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error('שיתוף קבצים אינו זמין במכשיר הזה');
        }
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'המידע שלי',
          UTI: 'public.json',
        });
      } finally {
        if (file.exists) file.delete();
      }
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
      await signOut({ forgetDeviceData: true });
    },
    onError: (e: any) => notify.error('שגיאה במחיקת החשבון', e.message),
  });
}
