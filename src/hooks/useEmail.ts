import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Send a newsletter now via the `send-emails` Edge Function.
export function useSendNewsletter() {
  return useMutation({
    mutationFn: async (newsletterId: number) => {
      const { data, error } = await supabase.functions.invoke('send-emails', {
        body: { mode: 'newsletter', newsletter_id: newsletterId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { sent: number; failed: number };
    },
    onSuccess: (r) => toast.success(`הניוזלטר נשלח ל-${r.sent} נמענים (${r.failed} נכשלו)`),
    onError: (e: any) => toast.error(`שגיאה בשליחת הניוזלטר: ${e.message}`),
  });
}

// Manually trigger the expiration-reminder run (normally invoked by cron).
export function useSendExpirationReminders() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-emails', {
        body: { mode: 'expiration_reminders' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { sent: number };
    },
    onSuccess: (r) => toast.success(`נשלחו ${r.sent} תזכורות תפוגה`),
    onError: (e: any) => toast.error(`שגיאה: ${e.message}`),
  });
}

// Send a test email to a given address.
export function useSendTestEmail() {
  return useMutation({
    mutationFn: async (to: string) => {
      const { data, error } = await supabase.functions.invoke('send-emails', {
        body: { mode: 'test', to },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success('מייל בדיקה נשלח'),
    onError: (e: any) => toast.error(`שגיאה: ${e.message}`),
  });
}
