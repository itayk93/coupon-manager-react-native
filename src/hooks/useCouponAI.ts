import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

function isLikelyCoupon(candidate: ParsedCoupon): boolean {
  const hasCode = Boolean(candidate.code && candidate.code.trim().length >= 4);
  const hasValue = typeof candidate.value === 'number' && Number.isFinite(candidate.value) && candidate.value > 0;
  const hasExpiration = Boolean(candidate.expiration || candidate.card_exp);
  const hasCvv = Boolean(candidate.cvv && candidate.cvv.trim().length >= 3);
  const hasCompany = Boolean(candidate.company && candidate.company.trim().length >= 2);

  const strongSignals = [hasCode, hasValue, hasExpiration, hasCvv].filter(Boolean).length;
  return strongSignals >= 2 || (hasCompany && strongSignals >= 1);
}

function extractCardExpiry(text: string): string | null {
  // Card expiry is commonly written as "תוקף: 08/31" or "תוקף 08/31".
  // Keep this deterministic fallback because an MM/YY value must not become
  // the coupon's full expiration date (which is stored as YYYY-MM-DD).
  const match = text.match(/(?:תוקף|תאריך\s+תוקף|expiry|exp(?:iration)?)\s*[:：-]?\s*(0[1-9]|1[0-2])\s*\/\s*(\d{2})\b/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

function extractVoucherCode(text: string): string | null {
  // Common Israeli voucher format: a long numeric group followed by a
  // four-digit group, e.g. 155454040-8782.
  return text.match(/\b\d{7,12}-\d{4}\b/)?.[0] || null;
}

// Calls the `parse-coupon` Supabase Edge Function which uses an LLM (OpenAI
// gpt-4o-mini) to extract one or more coupons from free text or an image.
export function useParseCoupon() {
  return useMutation({
    mutationFn: async ({ text, imageBase64, companyNames }: { text?: string; imageBase64?: string; companyNames?: string[] }) => {
      if (!text && !imageBase64) throw new Error('צריך טקסט או תמונה');

      const { data, error } = await supabase.functions.invoke('parse-coupon', {
        // No user_id: the function reads it from the verified JWT, so token
        // usage cannot be logged against another account.
        body: { text, imageBase64, companyNames },
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
      const textCardExpiry = text ? extractCardExpiry(text) : null;
      const textVoucherCode = text ? extractVoucherCode(text) : null;
      const normalizedCoupons = coupons.map((coupon: ParsedCoupon) => ({
        ...coupon,
        code: coupon.code || textVoucherCode,
        card_exp: coupon.card_exp || textCardExpiry,
      }));

      const filteredCoupons = normalizedCoupons.filter(isLikelyCoupon);
      if (filteredCoupons.length === 0) {
        throw new Error('לא זוהה קופון אמיתי בתמונה או בטקסט. נסה צילום ממוקד יותר של פרטי הקופון.');
      }

      return filteredCoupons;
    },
    retry: (failureCount, error) => {
      const isTemporaryNetworkError = /failed to send a request|fetch|network|connection/i.test(error.message);
      return failureCount < 1 && isTemporaryNetworkError;
    },
    retryDelay: 750,
    onError: (error: any) => {
      toast.error(`שגיאה בפענוח הקופון: ${error.message}`);
    },
  });
}
