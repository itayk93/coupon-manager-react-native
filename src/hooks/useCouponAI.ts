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
// gpt-4o-mini) to extract one or more coupons from free text or an image.
export function useParseCoupon() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ text, imageBase64 }: { text?: string; imageBase64?: string }) => {
      if (!text && !imageBase64) throw new Error('צריך טקסט או תמונה');

      const { data, error } = await supabase.functions.invoke('parse-coupon', {
        body: { text, imageBase64, user_id: user?.id },
      });

      if (error) {
        const context = (error as { context?: unknown }).context;
        if (context instanceof Response) {
          try {
            const body = await context.json();
            if (typeof body?.error === 'string') throw new Error(body.error);
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message) throw parseError;
          }
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);

      // `coupon` keeps older deployed function versions working while the new
      // response contract returns `coupons`.
      const coupons = Array.isArray(data?.coupons)
        ? data.coupons
        : data?.coupon
          ? [data.coupon]
          : [];

      if (coupons.length === 0) throw new Error('לא זוהו קופונים בטקסט או בתמונה');
      return coupons as ParsedCoupon[];
    },
    onError: (error: any) => {
      toast.error(`שגיאה בפענוח הקופון: ${error.message}`);
    },
  });
}
