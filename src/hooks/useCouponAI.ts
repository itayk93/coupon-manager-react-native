import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import {
  cardExpiryToExpiration,
  extractCardExpiry,
  extractExpiration,
  extractRedemptionUrl,
  extractRelativeExpiration,
  extractVerificationCode,
  extractVoucherCode,
  isActivationOffer,
} from "@/lib/couponTextFields";

export type ParsedCoupon = {
  company: string | null;
  code: string | null;
  value: number | null;
  cost: number | null;
  expiration: string | null;
  description: string | null;
  cvv: string | null;
  card_exp: string | null;
  redemption_url?: string | null;
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
      const cardExpiration = textCardExpiry
        ? cardExpiryToExpiration(textCardExpiry)
        : null;
      const textCvv = text ? extractVerificationCode(text) : null;
      const textVoucherCode = text ? extractVoucherCode(text) : null;
      const activationOffer = text ? isActivationOffer(text) : false;
      // A single-coupon text is the only case where a date found in the text can
      // safely be applied: with several coupons there is no telling which one it
      // belongs to.
      const textExpiration =
        text && coupons.length === 1 ? extractExpiration(text) : null;
      const relativeExpiration =
        text && coupons.length === 1 ? extractRelativeExpiration(text) : null;
      const textRedemptionUrl = text ? extractRedemptionUrl(text) : null;
      const normalizedCoupons = coupons.map((coupon: ParsedCoupon) => ({
        ...coupon,
        code: activationOffer ? null : textVoucherCode || coupon.code,
        value: activationOffer && coupon.value == null ? 0 : coupon.value,
        description: activationOffer ? text?.trim() || coupon.description : coupon.description,
        card_exp: textCardExpiry || coupon.card_exp,
        cvv: textCvv || coupon.cvv,
        expiration: textExpiration || relativeExpiration || cardExpiration || coupon.expiration,
        redemption_url: textRedemptionUrl || coupon.redemption_url,
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
