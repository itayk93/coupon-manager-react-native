import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";
import { COUPON_TRANSACTION_COLUMNS, COUPON_USAGE_COLUMNS } from "@/lib/tableColumns";
import {
  isHiddenLedgerRow,
  ledgerAmountFromTransaction,
  ledgerAmountFromUsage,
  missingUsageFromLedger,
  usedValueFromLedger,
} from "@/lib/couponLedger";
import { DecryptedCoupon } from "./useCoupons";

export type ConsolidatedRow = {
  id: number | string;
  coupon_id: number;
  timestamp: string | null;
  transaction_amount: number;
  details: string;
  place_name: string | null;
  place_address: string | null;
  latitude: number | null;
  longitude: number | null;
  source_table: "coupon_usage" | "coupon_transaction" | "sum_row";
};

export type CouponUsageStats = {
  usageCountByCoupon: Record<number, number>;
  usageCountByCompany: Record<string, number>;
  latestUsageByCoupon: Record<number, number>;
  latestUsageByCompany: Record<string, number>;
};

type CachedCouponPlace = {
  normalized_name: string | null;
  place_name: string | null;
  place_address: string | null;
  latitude: number | null;
  longitude: number | null;
};

function normalizePlaceName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("he-IL")
    .replace(/["'׳״.,()\-]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Aggregates actual coupon usage counts and latest usage timestamps
 * across coupon_usage and coupon_transaction for all coupons belonging to the user.
 */
export function useCouponUsageStats(coupons: DecryptedCoupon[] = []) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["coupon_usage_stats", user?.id, coupons.map((c) => `${c.id}:${c.used_value}`).join(",")],
    queryFn: async (): Promise<CouponUsageStats> => {
      if (!user || coupons.length === 0) {
        return {
          usageCountByCoupon: {},
          usageCountByCompany: {},
          latestUsageByCoupon: {},
          latestUsageByCompany: {},
        };
      }

      const couponIds = coupons.map((c) => c.id);

      const [usageRes, txRes] = await Promise.all([
        supabase
          .from("coupon_usage")
          .select("coupon_id, details, action, timestamp")
          .in("coupon_id", couponIds),
        supabase
          .from("coupon_transaction")
          .select("coupon_id, location, source, usage_amount, transaction_date")
          .in("coupon_id", couponIds),
      ]);

      const usageCountByCoupon: Record<number, number> = {};
      const latestUsageByCoupon: Record<number, number> = {};

      (usageRes.data || []).forEach((u) => {
        const details = u.details || u.action || "";
        if (isHiddenLedgerRow(details)) return;
        usageCountByCoupon[u.coupon_id] = (usageCountByCoupon[u.coupon_id] || 0) + 1;
        if (u.timestamp) {
          const ts = new Date(u.timestamp).getTime();
          if (!isNaN(ts)) {
            latestUsageByCoupon[u.coupon_id] = Math.max(latestUsageByCoupon[u.coupon_id] || 0, ts);
          }
        }
      });

      (txRes.data || []).forEach((t) => {
        const details = t.location || t.source || "";
        if (isHiddenLedgerRow(details)) return;
        usageCountByCoupon[t.coupon_id] = (usageCountByCoupon[t.coupon_id] || 0) + 1;
        const dateStr = t.transaction_date;
        if (dateStr) {
          const ts = new Date(dateStr).getTime();
          if (!isNaN(ts)) {
            latestUsageByCoupon[t.coupon_id] = Math.max(latestUsageByCoupon[t.coupon_id] || 0, ts);
          }
        }
      });

      // If a coupon has used_value > 0 but no explicit rows
      coupons.forEach((coupon) => {
        if ((coupon.used_value || 0) > 0) {
          if (!usageCountByCoupon[coupon.id]) {
            usageCountByCoupon[coupon.id] = 1;
          }
          if (!latestUsageByCoupon[coupon.id] && coupon.date_added) {
            const ts = new Date(coupon.date_added).getTime();
            if (!isNaN(ts)) {
              latestUsageByCoupon[coupon.id] = ts;
            }
          }
        }
      });

      const usageCountByCompany: Record<string, number> = {};
      const latestUsageByCompany: Record<string, number> = {};
      coupons.forEach((coupon) => {
        const company = (coupon.company || "").trim();
        if (company) {
          const count = usageCountByCoupon[coupon.id] || 0;
          usageCountByCompany[company] = (usageCountByCompany[company] || 0) + count;
          const latest = latestUsageByCoupon[coupon.id] || 0;
          latestUsageByCompany[company] = Math.max(latestUsageByCompany[company] || 0, latest);
        }
      });

      return {
        usageCountByCoupon,
        usageCountByCompany,
        latestUsageByCoupon,
        latestUsageByCompany,
      };
    },
    enabled: !!user && coupons.length > 0,
  });
}

// Full usage & transaction history for a single coupon
export function useCouponUsageHistory(coupon: DecryptedCoupon | null) {
  return useQuery({
    queryKey: ["coupon_usage", coupon?.id],
    queryFn: async (): Promise<ConsolidatedRow[]> => {
      if (!coupon) return [];

      const couponId = coupon.id;

      const [usageResult, transactionResult, placesResult] = await Promise.all([
        supabase
          .from("coupon_usage")
          .select(COUPON_USAGE_COLUMNS)
          .eq("coupon_id", couponId),
        supabase
          .from("coupon_transaction")
          .select(COUPON_TRANSACTION_COLUMNS)
          .eq("coupon_id", couponId),
        (supabase as any)
          .from("coupon_places")
          .select("normalized_name,place_name,place_address,latitude,longitude"),
      ]);

      if (usageResult.error) throw usageResult.error;
      if (transactionResult.error) throw transactionResult.error;
      if (placesResult.error) throw placesResult.error;

      const usageData = usageResult.data;
      const txData = transactionResult.data;
      const placesByName = new Map<string, CachedCouponPlace>();
      ((placesResult.data || []) as CachedCouponPlace[]).forEach((place) => {
        if (place.normalized_name) placesByName.set(normalizePlaceName(place.normalized_name), place);
        if (place.place_name) placesByName.set(normalizePlaceName(place.place_name), place);
      });

      const rows: ConsolidatedRow[] = [];
      const ledgerAmounts: number[] = [];

      // Map coupon_usage
      (usageData || []).forEach((u) => {
        const details = u.details || u.action || "שימוש בקופון";
        if (isHiddenLedgerRow(details)) return;
        const amount = ledgerAmountFromUsage(u.used_amount);
        ledgerAmounts.push(amount);
        rows.push({
          id: u.id,
          coupon_id: u.coupon_id,
          timestamp: u.timestamp,
          transaction_amount: amount,
          details,
          place_name: u.place_name,
          place_address: u.place_address,
          latitude: u.latitude,
          longitude: u.longitude,
          source_table: "coupon_usage",
        });
      });

      // Map coupon_transaction
      (txData || []).forEach((t) => {
        const amount = ledgerAmountFromTransaction(t.recharge_amount, t.usage_amount);
        const details = t.location || t.source || "עסקת קופון";
        if (isHiddenLedgerRow(details)) return;
        const cachedPlace = t.location
          ? placesByName.get(normalizePlaceName(t.location))
          : undefined;
        ledgerAmounts.push(amount);
        rows.push({
          id: t.id,
          coupon_id: t.coupon_id,
          timestamp: t.transaction_date || new Date().toISOString(),
          transaction_amount: amount,
          details,
          place_name: cachedPlace?.place_name || t.location || null,
          place_address: cachedPlace?.place_address || t.location || null,
          latitude: cachedPlace?.latitude ?? null,
          longitude: cachedPlace?.longitude ?? null,
          source_table: "coupon_transaction",
        });
      });

      // Multipass and legacy imports can update coupon.used_value without a
      // matching history row. Keep that prior usage visible after later manual
      // rows are added instead of dropping it as soon as the ledger is non-empty.
      const missingUsage = missingUsageFromLedger(
        coupon.value,
        coupon.used_value,
        ledgerAmounts
      );
      if (missingUsage > 0) {
        rows.push({
          id: `unrecorded-usage-${coupon.id}`,
          coupon_id: coupon.id,
          timestamp: coupon.date_added || new Date().toISOString(),
          transaction_amount: -missingUsage,
          details: "שימוש קודם בקופון",
          place_name: null,
          place_address: null,
          latitude: null,
          longitude: null,
          source_table: "coupon_usage",
        });
      }

      // Sort rows ascending by timestamp (earliest to latest)
      rows.sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      // Summary / remaining balance row
      const remainingBalance = Math.max(0, coupon.value - coupon.used_value);
      rows.push({
        id: `sum-${coupon.id}`,
        coupon_id: coupon.id,
        timestamp: null,
        transaction_amount: remainingBalance,
        details: "סה״כ יתרה בקופון",
        place_name: null,
        place_address: null,
        latitude: null,
        longitude: null,
        source_table: "sum_row",
      });

      return rows;
    },
    enabled: !!coupon,
  });
}

export function useRecordUsage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      couponId,
        usedAmount,
        details,
        placeName,
        placeAddress,
        latitude,
        longitude,
        timestamp,
      }: {
        couponId: number;
        usedAmount: number;
        details?: string;
        placeName?: string;
        placeAddress?: string;
        latitude?: number | null;
        longitude?: number | null;
        timestamp?: string | null;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: coupon, error: fetchErr } = await supabase
        .from("coupon")
        .select("id, value, used_value")
        .eq("id", couponId)
        .eq("user_id", user.id)
        .single();
      if (fetchErr) throw fetchErr;

      const newUsed = Math.min(coupon.value, (coupon.used_value || 0) + usedAmount);
      const fullyUsed = newUsed >= coupon.value;

      const { error: usageErr } = await supabase.from("coupon_usage").insert({
        coupon_id: couponId,
        used_amount: usedAmount,
        action: "usage",
        details: details || null,
        place_name: placeName?.trim() || null,
        place_address: placeAddress?.trim() || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        timestamp: timestamp || new Date().toISOString(),
      });
      if (usageErr) throw usageErr;

      const { error: updateErr } = await supabase
        .from("coupon")
        .update({ used_value: newUsed, status: fullyUsed ? "נוצל" : "פעיל" })
        .eq("id", couponId)
        .eq("user_id", user.id);
      if (updateErr) throw updateErr;

      return { newUsed, fullyUsed };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["coupon_usage", variables.couponId] });
      queryClient.invalidateQueries({ queryKey: ["coupon_usage_stats"] });
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      queryClient.invalidateQueries({ queryKey: ["coupon", variables.couponId] });
    },
    onError: (error: any) => {
      notify.error("שגיאה ברישום השימוש", error.message);
    },
  });
}

export function useDeleteTransactionRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordId,
      sourceTable,
      couponId,
    }: {
      recordId: number | string;
      sourceTable: "coupon_usage" | "coupon_transaction" | "sum_row";
      couponId: number;
    }) => {
      if (typeof recordId === "string") return { couponId };

      if (sourceTable === "coupon_usage") {
        const { error } = await supabase.from("coupon_usage").delete().eq("id", recordId);
        if (error) throw error;
      } else if (sourceTable === "coupon_transaction") {
        const { error } = await supabase.from("coupon_transaction").delete().eq("id", recordId);
        if (error) throw error;
      }

      // Recalculate the coupon balance from the remaining records
      const { data: usageRows } = await supabase
        .from("coupon_usage")
        .select("used_amount, action, details")
        .eq("coupon_id", couponId);

      const { data: txRows } = await supabase
        .from("coupon_transaction")
        .select("usage_amount, recharge_amount, location, source")
        .eq("coupon_id", couponId);

      // Same rows, same rule as the history list: anything hidden there is a
      // duplicate of a row that is shown, so counting it would spend twice.
      const ledger = [
        ...(usageRows || [])
          .filter((r) => !isHiddenLedgerRow(r.details || r.action || ""))
          .map((r) => ledgerAmountFromUsage(r.used_amount)),
        ...(txRows || [])
          .filter((r) => !isHiddenLedgerRow(r.location || r.source || ""))
          .map((r) => ledgerAmountFromTransaction(r.recharge_amount, r.usage_amount)),
      ];

      const { data: couponRow } = await supabase
        .from("coupon")
        .select("value, status")
        .eq("id", couponId)
        .single();

      if (couponRow) {
        const capped = usedValueFromLedger(couponRow.value, ledger);
        const fullyUsed = capped >= couponRow.value;
        const keepStatus =
          couponRow.status === "נוצל" || couponRow.status === "פעיל"
            ? null
            : couponRow.status;

        const { error: updateErr } = await supabase
          .from("coupon")
          .update({
            used_value: capped,
            status: keepStatus ?? (fullyUsed ? "נוצל" : "פעיל"),
          })
          .eq("id", couponId);
        if (updateErr) throw updateErr;
      }

      return { couponId };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["coupon_usage", variables.couponId] });
      queryClient.invalidateQueries({ queryKey: ["coupon_usage_stats"] });
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      queryClient.invalidateQueries({ queryKey: ["coupon", variables.couponId] });
    },
    onError: (error: any) => {
      notify.error("שגיאה במחיקת הרשומה", error.message);
    },
  });
}
