import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";
import { COUPON_TRANSACTION_COLUMNS, COUPON_USAGE_COLUMNS } from "@/lib/tableColumns";
import { DecryptedCoupon } from "./useCoupons";

const HIDDEN_AUTO_USAGE_DETAILS = new Set([
  "עדכון אוטומטי via Multipass daily flow",
]);

function shouldHideHistoryDetails(details: string) {
  const normalized = details.trim();
  if (!normalized) return false;
  if (HIDDEN_AUTO_USAGE_DETAILS.has(normalized)) return true;
  return normalized.toLowerCase().includes("multipass daily flow");
}

export type ConsolidatedRow = {
  id: number | string;
  coupon_id: number;
  timestamp: string | null;
  transaction_amount: number;
  details: string;
  source_table: "coupon_usage" | "coupon_transaction" | "sum_row";
};

// Full usage & transaction history for a single coupon
export function useCouponUsageHistory(coupon: DecryptedCoupon | null) {
  return useQuery({
    queryKey: ["coupon_usage", coupon?.id],
    queryFn: async (): Promise<ConsolidatedRow[]> => {
      if (!coupon) return [];

      const couponId = coupon.id;

      // Fetch from coupon_usage
      const { data: usageData } = await supabase
        .from("coupon_usage")
        .select(COUPON_USAGE_COLUMNS)
        .eq("coupon_id", couponId);

      // Fetch from coupon_transaction
      const { data: txData } = await supabase
        .from("coupon_transaction")
        .select(COUPON_TRANSACTION_COLUMNS)
        .eq("coupon_id", couponId);

      const rows: ConsolidatedRow[] = [];

      // Map coupon_usage
      (usageData || []).forEach((u) => {
        const details = u.details || u.action || "שימוש בקופון";
        if (shouldHideHistoryDetails(details)) return;
        rows.push({
          id: u.id,
          coupon_id: u.coupon_id,
          timestamp: u.timestamp,
          transaction_amount: -Math.abs(u.used_amount),
          details,
          source_table: "coupon_usage",
        });
      });

      // Map coupon_transaction
      (txData || []).forEach((t) => {
        const usage = t.usage_amount || 0;
        const recharge = t.recharge_amount || 0;
        const amount = recharge - usage;
        const details = t.location || t.source || "עסקת קופון";
        if (shouldHideHistoryDetails(details)) return;
        rows.push({
          id: t.id,
          coupon_id: t.coupon_id,
          timestamp: t.transaction_date || new Date().toISOString(),
          transaction_amount: amount,
          details,
          source_table: "coupon_transaction",
        });
      });

      // Fallback: If no records exist, synthesize history
      if (rows.length === 0) {
        if (coupon.value > 0) {
          rows.push({
            id: `init-charge-${coupon.id}`,
            coupon_id: coupon.id,
            timestamp: coupon.date_added || new Date().toISOString(),
            transaction_amount: coupon.value,
            details: "טעינה ראשונית / יצירת קופון",
            source_table: "coupon_transaction",
          });
        }
        if (coupon.used_value > 0) {
          rows.push({
            id: `init-usage-${coupon.id}`,
            coupon_id: coupon.id,
            timestamp: coupon.date_added || new Date().toISOString(),
            transaction_amount: -coupon.used_value,
            details: "שימוש בקופון",
            source_table: "coupon_usage",
          });
        }
      }

      // Sort rows descending by timestamp
      rows.sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      // Summary / remaining balance row
      const remainingBalance = Math.max(0, coupon.value - coupon.used_value);
      rows.push({
        id: `sum-${coupon.id}`,
        coupon_id: coupon.id,
        timestamp: null,
        transaction_amount: remainingBalance,
        details: "סה״כ יתרה בקופון",
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
    }: {
      couponId: number;
      usedAmount: number;
      details?: string;
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
        timestamp: new Date().toISOString(),
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
        .select("used_amount")
        .eq("coupon_id", couponId);

      const { data: txRows } = await supabase
        .from("coupon_transaction")
        .select("usage_amount")
        .eq("coupon_id", couponId);

      const newUsed =
        (usageRows || []).reduce((sum, r) => sum + Math.abs(r.used_amount || 0), 0) +
        (txRows || []).reduce((sum, r) => sum + Math.abs(r.usage_amount || 0), 0);

      const { data: couponRow } = await supabase
        .from("coupon")
        .select("value, status")
        .eq("id", couponId)
        .single();

      if (couponRow) {
        const capped = Math.min(couponRow.value, newUsed);
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
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      queryClient.invalidateQueries({ queryKey: ["coupon", variables.couponId] });
    },
    onError: (error: any) => {
      notify.error("שגיאה במחיקת הרשומה", error.message);
    },
  });
}
