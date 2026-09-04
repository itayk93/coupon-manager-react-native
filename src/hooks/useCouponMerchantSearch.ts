import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CouponMerchantMatch = {
  couponId: number;
  provider: string;
  reason: string;
  confidence: "high" | "medium";
};

export type CouponMerchantSearchResult = {
  query: string;
  directCouponIds: number[];
  matches: CouponMerchantMatch[];
  sources: string[];
  checkedAt: string;
  cached: boolean;
};

export function isMerchantQuery(value: string): boolean {
  const query = value.trim();
  return query.length >= 2 && /[\p{L}]/u.test(query);
}

async function searchCouponMerchants(query: string): Promise<CouponMerchantSearchResult> {
  const { data, error } = await supabase.functions.invoke("search-coupon-merchants", {
    body: { query },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.data as CouponMerchantSearchResult;
}

export function useCouponMerchantSearch(query: string) {
  const { user } = useAuth();
  const normalized = query.trim();
  return useQuery({
    queryKey: ["coupon-merchant-search", user?.id, normalized.toLocaleLowerCase("he-IL")],
    queryFn: () => searchCouponMerchants(normalized),
    enabled: user?.id === 1 && isMerchantQuery(normalized),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
