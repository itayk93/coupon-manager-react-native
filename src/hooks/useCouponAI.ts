import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ParsedCoupon = {
  company: string | null;
  code: string | null;
  value: number | null;
  cost: number | null;
  expiration: string | null; // ISO date
  description: string | null;
  cvv: string | null;
  card_exp: string | null;
};

// Calls the `parse-coupon` Supabase Edge Function which uses an LLM (OpenAI
// gpt-4o-mini) to extract structured coupon fields from free text or an image.
export function useParseCoupon() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ text, imageBase64 }: { text?: string; imageBase64?: string }) => {
      if (!text && !imageBase64) throw new Error('צריך טקסט או תמונה');

      const { data, error } = await supabase.functions.invoke('parse-coupon', {
        body: { text, imageBase64, user_id: user?.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.coupon as ParsedCoupon;
    },
    onError: (error: any) => {
      toast.error(`שגיאה בפענוח הקופון: ${error.message}`);
    },
  });
}
