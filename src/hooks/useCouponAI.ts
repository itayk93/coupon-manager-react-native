import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

export type ParsedCoupon = {
  company: string | null;
  code: string | null;
  value: number | null;
  cost: number | null;
  expiration: string | null;
  description: string | null;
  cvv: string | null;
  card_exp: string | null;
};

function isLikelyCoupon(candidate: ParsedCoupon): boolean {
  const hasCode = Boolean(candidate.code && candidate.code.trim().length >= 4);
  const hasValue = typeof candidate.value === "number" && Number.isFinite(candidate.value) && candidate.value > 0;
  const hasExpiration = Boolean(candidate.expiration || candidate.card_exp);
  const hasCvv = Boolean(candidate.cvv && candidate.cvv.trim().length >= 3);
  const hasCompany = Boolean(candidate.company && candidate.company.trim().length >= 2);

  const strongSignals = [hasCode, hasValue, hasExpiration, hasCvv].filter(Boolean).length;
  return strongSignals >= 2 || (hasCompany && strongSignals >= 1);
}

function extractCardExpiry(text: string): string | null {
  const match = text.match(/(?:תוקף|תאריך\s+תוקף|expiry|exp(?:iration)?)\s*[:：-]?\s*(0[1-9]|1[0-2])\s*\/\s*(\d{2})\b/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

function extractVoucherCode(text: string): string | null {
  return text.match(/\b(?:\d{7,12}-\d{4}|\d{4}(?:-\d{4}){3})\b/)?.[0] || null;
}

/**
 * Pulls the expiry out of an explicit "בתוקף עד 02.08.2031" / "תוקף השובר: 31/07/2031"
 * phrase. The model has been seen rounding such a date to the end of the month
 * (02.08.2031 → 2031-08-31), and a dotted day-first date is unambiguous enough to
 * read here instead of trusting it.
 *
 * The wording is required to mention תוקף, so unrelated deadlines in the same text
 * ("יש להוריד את השובר עד לתאריך 19.8.26") are not picked up.
 */
function extractExpiration(text: string): string | null {
  const match = text.match(
    /(?:בתוקף|תוקף(?:\s+(?:ה?שובר|ה?קופון|ה?מתנה))?)\s*(?:עד|ל)?\s*(?:לתאריך)?\s*[:：-]?\s*(\d{1,2})[./](\d{1,2})[./](\d{2,4})/
  );
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

export function useParseCoupon() {
  return useMutation({
    mutationFn: async ({ text, imageBase64, companyNames }: { text?: string; imageBase64?: string; companyNames?: string[] }) => {
      if (!text && !imageBase64) throw new Error("צריך טקסט או תמונה");

      const { data, error } = await supabase.functions.invoke("parse-coupon", {
        body: { text, imageBase64, companyNames },
      });

      if (error) {
        throw error;
      }
      if (data?.error) throw new Error(data.error);

      const coupons = Array.isArray(data?.coupons)
        ? data.coupons
        : data?.coupon
        ? [data.coupon]
        : [];

      if (coupons.length === 0) throw new Error("לא זוהו קופונים בטקסט או בתמונה");
      const textCardExpiry = text ? extractCardExpiry(text) : null;
      const textVoucherCode = text ? extractVoucherCode(text) : null;
      // A single-coupon text is the only case where a date found in the text can
      // safely be applied: with several coupons there is no telling which one it
      // belongs to.
      const textExpiration =
        text && coupons.length === 1 ? extractExpiration(text) : null;
      const normalizedCoupons = coupons.map((coupon: ParsedCoupon) => ({
        ...coupon,
        code: coupon.code || textVoucherCode,
        card_exp: coupon.card_exp || textCardExpiry,
        expiration: textExpiration || coupon.expiration,
      }));

      const filteredCoupons = normalizedCoupons.filter(isLikelyCoupon);
      if (filteredCoupons.length === 0) {
        throw new Error("לא זוהה קופון אמיתי בתמונה או בטקסט. נסה שוב.");
      }

      return filteredCoupons;
    },
    onError: (error: any) => {
      const technicalMessage = String(error?.message || "");
      const message = /Edge Function|non-2xx|Failed to fetch|Network/i.test(technicalMessage)
        ? "לא הצלחנו להתחבר לזיהוי החכם. בדקו את הפרטים ונסו שוב."
        : technicalMessage || "לא הצלחנו לזהות קופון. נסו לנסח שוב."
      notify.error("לא הצלחנו לזהות הפעם", message);
    },
  });
}
