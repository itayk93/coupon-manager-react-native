import { useQuery } from "@tanstack/react-query";
import { useCoupons } from "@/hooks/useCoupons";
import { supabase } from "@/integrations/supabase/client";

export type BoughtTransaction = {
  id: string;
  couponId: number;
  date: string | null;
  amount: number;
  source: string;
};

export type BoughtPlace = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  visits: number;
  total: number;
  transactions: BoughtTransaction[];
};

type RawTransaction = {
  id: number;
  coupon_id: number;
  location: string | null;
  usage_amount: number | null;
  transaction_date: string | null;
  source: string | null;
};

type RawUsage = {
  id: number;
  coupon_id: number;
  details: string | null;
  place_name: string | null;
  place_address: string | null;
  latitude: number | null;
  longitude: number | null;
  used_amount: number;
  timestamp: string | null;
};

type PlaceCache = {
  normalized_name: string | null;
  place_name: string | null;
  place_address: string | null;
  latitude: number | null;
  longitude: number | null;
};

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("he-IL")
    .replace(/["'׳״.,()\-]/g, " ")
    .replace(/\s+/g, " ");
}

function isAutomaticAudit(details: string | null): boolean {
  const value = details?.trim().toLocaleLowerCase("he-IL") || "";
  return value.includes("multipass daily flow") || value.includes("via github action");
}

function isSpend(row: RawTransaction): boolean {
  return Number(row.usage_amount || 0) > 0 && Boolean(row.location?.trim());
}

export function useWhereBought() {
  const { data: coupons = [], isLoading: couponsLoading } = useCoupons();
  const couponIds = coupons.map((coupon) => coupon.id).filter(Boolean);

  const query = useQuery({
    queryKey: ["where-bought", couponIds.join(",")],
    enabled: couponIds.length > 0,
    queryFn: async (): Promise<BoughtPlace[]> => {
      const [transactionsResult, usagesResult, placesResult] = await Promise.all([
        supabase
          .from("coupon_transaction")
          .select("id,coupon_id,location,usage_amount,transaction_date,source")
          .in("coupon_id", couponIds),
        supabase
          .from("coupon_usage")
          .select("id,coupon_id,details,place_name,place_address,latitude,longitude,used_amount,timestamp")
          .in("coupon_id", couponIds),
        (supabase as any)
          .from("coupon_places")
          .select("normalized_name,place_name,place_address,latitude,longitude"),
      ]);

      if (transactionsResult.error) throw transactionsResult.error;
      if (usagesResult.error) throw usagesResult.error;
      if (placesResult.error) throw placesResult.error;

      const cache = (placesResult.data || []) as PlaceCache[];
      const cacheByName = new Map<string, PlaceCache>();
      cache.forEach((place) => {
        if (place.normalized_name) cacheByName.set(normalize(place.normalized_name), place);
        if (place.place_name) cacheByName.set(normalize(place.place_name), place);
      });

      const grouped = new Map<string, BoughtPlace>();
      const add = (key: string, item: Omit<BoughtPlace, "id" | "visits" | "total" | "transactions">, transaction: BoughtTransaction) => {
        const existing = grouped.get(key);
        if (existing) {
          existing.visits += 1;
          existing.total += transaction.amount;
          existing.transactions.push(transaction);
          return;
        }
        grouped.set(key, { ...item, id: key, visits: 1, total: transaction.amount, transactions: [transaction] });
      };

      (transactionsResult.data as RawTransaction[]).filter(isSpend).forEach((row) => {
        const rawName = row.location!.trim();
        const place = cacheByName.get(normalize(rawName));
        if (!place || place.latitude == null || place.longitude == null) return;
        const key = `${place.latitude}:${place.longitude}`;
        add(key, {
          name: place.place_name || rawName,
          address: place.place_address,
          latitude: place.latitude,
          longitude: place.longitude,
        }, {
          id: `transaction-${row.id}`,
          couponId: row.coupon_id,
          date: row.transaction_date,
          amount: Number(row.usage_amount || 0),
          source: row.source || "קופון",
        });
      });

      (usagesResult.data as RawUsage[]).forEach((row) => {
        if (isAutomaticAudit(row.details) || !row.place_name || row.latitude == null || row.longitude == null) return;
        const key = `${row.latitude}:${row.longitude}`;
        add(key, {
          name: row.place_name,
          address: row.place_address,
          latitude: row.latitude,
          longitude: row.longitude,
        }, {
          id: `usage-${row.id}`,
          couponId: row.coupon_id,
          date: row.timestamp,
          amount: Math.abs(Number(row.used_amount || 0)),
          source: "דיווח שימוש",
        });
      });

      return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
    },
  });

  return { ...query, isLoading: couponsLoading || query.isLoading };
}
