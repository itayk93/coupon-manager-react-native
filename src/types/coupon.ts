import type { Coupon } from "@/integrations/supabase";

export type DecryptedCoupon = Omit<
  Coupon,
  | "code"
  | "description"
  | "buyme_coupon_url"
  | "strauss_coupon_url"
  | "xgiftcard_coupon_url"
  | "xtra_coupon_url"
  | "cvv"
  | "card_exp"
> & {
  code: string;
  description: string | null;
  buyme_coupon_url: string | null;
  strauss_coupon_url: string | null;
  xgiftcard_coupon_url: string | null;
  xtra_coupon_url: string | null;
  cvv: string | null;
  card_exp: string | null;
  is_shared_with_me?: boolean;
};

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

export type ParsedUsage = {
  id: string;
  amount: number;
  placeName: string;
  usedAt: string | null;
  details: string;
  placeAddress: string;
  latitude: number | null;
  longitude: number | null;
};

export type ParsedUsageScreenshot = {
  couponCode: string | null;
  couponCodeConfidence: number;
  companyName: string | null;
  warnings: string[];
  usages: ParsedUsage[];
};


