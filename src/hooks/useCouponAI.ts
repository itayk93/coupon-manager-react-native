import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import {
  cardExpiryToExpiration,
  extractAllCardExpiries,
  extractAllVerificationCodes,
  extractAllVoucherCodes,
  extractExpiration,
  extractRedemptionUrl,
  extractRelativeExpiration,
  extractSharedPageUrl,
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

      const sharedPageUrl = text ? extractSharedPageUrl(text) : null;

      const { data, error } = await supabase.functions.invoke("parse-coupon", {
        body: { text, imageBase64, companyNames, sourceUrl: sharedPageUrl },
      });

      if (error) {
        // A non-2xx from the edge function lands here with `data` null and the
        // real Hebrew reason sitting in the unread response body. Surface it
        // instead of the generic "couldn't connect" message.
        const body = (error as { context?: Response })?.context;
        let serverMessage: string | null = null;
        if (body && typeof body.json === "function") {
          try {
            serverMessage = (await body.json())?.error ?? null;
          } catch {
            serverMessage = null;
          }
        }
        throw serverMessage ? new Error(serverMessage) : error;
      }
      if (data?.error) throw new Error(data.error);

      let coupons: ParsedCoupon[] = Array.isArray(data?.coupons)
        ? data.coupons
        : data?.coupon
        ? [data.coupon]
        : [];

      if (coupons.length === 0) throw new Error("לא זוהו קופונים בטקסט או בתמונה");

      // Labeled fields read straight from the text are exact where the model
      // may transcribe a digit wrong. A message can hold several coupons, each
      // with its own code / CVV / expiry block, so the n-th match goes to the
      // n-th coupon — never the first match to all of them.
      const textCodes = text ? extractAllVoucherCodes(text) : [];
      const textCvvs = text ? extractAllVerificationCodes(text) : [];
      const textCardExpiries = text ? extractAllCardExpiries(text) : [];

      // The model sometimes folds a multi-coupon message into a single item.
      // When the text plainly lists more codes, split it back out.
      if (coupons.length === 1 && textCodes.length > 1) {
        coupons = textCodes.map(() => ({ ...coupons[0] }));
      }

      /**
       * The text's value for coupon `i`: only when the text has exactly one per
       * coupon. A `shared` field (expiry) may also be one value for all of them.
       */
      const forCoupon = (values: string[], i: number, shared = false): string | null => {
        if (values.length === coupons.length) return values[i];
        if (coupons.length === 1) return values[0] ?? null;
        if (shared && values.length >= 1 && new Set(values).size === 1) return values[0];
        return null;
      };

      const activationOffer = text ? isActivationOffer(text) : false;
      // A single-coupon text is the only case where a date found in the text can
      // safely be applied: with several coupons there is no telling which one it
      // belongs to.
      const textExpiration =
        text && coupons.length === 1 ? extractExpiration(text) : null;
      const relativeExpiration =
        text && coupons.length === 1 ? extractRelativeExpiration(text) : null;
      const textRedemptionUrl = text ? extractRedemptionUrl(text) : null;
      const normalizedCoupons = coupons.map((coupon: ParsedCoupon, i: number) => {
        const textCardExpiry = forCoupon(textCardExpiries, i, true);
        const cardExpiration = textCardExpiry ? cardExpiryToExpiration(textCardExpiry) : null;
        return {
          ...coupon,
          code: activationOffer ? null : forCoupon(textCodes, i) || coupon.code,
          value: activationOffer && coupon.value == null ? 0 : coupon.value,
          description: activationOffer ? text?.trim() || coupon.description : coupon.description,
          card_exp: textCardExpiry || coupon.card_exp,
          cvv: forCoupon(textCvvs, i) || coupon.cvv,
          expiration: textExpiration || relativeExpiration || cardExpiration || coupon.expiration,
          // A browser share explicitly identifies the coupon page. Preserve it
          // even if page copy also contains unrelated balance/help links.
          redemption_url: sharedPageUrl || textRedemptionUrl || coupon.redemption_url,
        };
      });

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
