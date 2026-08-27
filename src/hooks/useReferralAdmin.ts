import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";

/**
 * The admin side of the referral pilot.
 *
 * Every query here goes straight at the tables, and every one of them is
 * allowed only by a policy that calls `is_app_admin()` inside the database.
 * The `isAdmin` flag below decides what to render; it decides nothing about
 * what may be read. A non-admin who reaches these calls gets empty results
 * from Postgres, not from React.
 */

export type ReferralCampaign = {
  id: number;
  name: string;
  partner_name: string;
  code: string;
  active: boolean;
  notes: string | null;
};

export type ReferralReward = {
  id: number;
  label: string;
  metric: "activated" | "retained";
  threshold: number;
  reward_type: "dream_card" | "cash";
  reward_value: number;
  earned_at: string | null;
  paid_at: string | null;
  paid_note: string | null;
};

export type ReferralRow = {
  id: number;
  campaign_id: number;
  depth: number;
  status: "registered" | "activated" | "retained";
  fraud_status: "normal" | "review" | "rejected";
  fraud_reasons: string[];
  review_note: string | null;
  registered_at: string;
  first_coupon_at: string | null;
  activated_at: string | null;
  retained_at: string | null;
  coupon_count: number;
  active_days_first_30: number;
  active_days_31_60: number;
  referral_code: string;
  referred_user_id: number;
  referred_email: string;
  referred_name: string;
  referrer_user_id: number | null;
  referrer_name: string | null;
};

function useAdminGuard() {
  const { isAdmin } = useAuth();
  return isAdmin;
}

export function useReferralCampaigns() {
  const isAdmin = useAdminGuard();
  return useQuery({
    queryKey: ["referral_campaigns"],
    queryFn: async (): Promise<ReferralCampaign[]> => {
      const { data, error } = await supabase
        .from("referral_campaigns")
        .select("id,name,partner_name,code,active,notes")
        .order("id");
      if (error) throw error;
      return (data ?? []) as ReferralCampaign[];
    },
    enabled: isAdmin,
  });
}

export function useReferralRewards(campaignId: number | null) {
  const isAdmin = useAdminGuard();
  return useQuery({
    queryKey: ["referral_rewards", campaignId],
    queryFn: async (): Promise<ReferralReward[]> => {
      const { data, error } = await supabase
        .from("referral_rewards")
        .select("id,label,metric,threshold,reward_type,reward_value,earned_at,paid_at,paid_note")
        .eq("campaign_id", campaignId!)
        .order("metric")
        .order("threshold");
      if (error) throw error;
      return (data ?? []) as ReferralReward[];
    },
    enabled: isAdmin && campaignId !== null,
  });
}

export function useReferralRows(campaignId: number | null) {
  const isAdmin = useAdminGuard();
  return useQuery({
    queryKey: ["referral_rows", campaignId],
    queryFn: async (): Promise<ReferralRow[]> => {
      const { data, error } = await supabase
        .from("referral_admin_rows")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("registered_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ReferralRow[];
    },
    enabled: isAdmin && campaignId !== null,
  });
}

/**
 * What the numbers at the top of the screen mean.
 *
 * Counted in the client rather than in SQL because the same rows are already
 * on screen — a second round trip to total up a list we are holding would only
 * add a way for the header and the table to disagree.
 *
 * `rejected` rows are excluded from every total, and `review` rows are counted
 * separately, so nothing that is still being argued about can push a partner
 * over a threshold.
 */
export function summarizeReferrals(rows: ReferralRow[]) {
  const counted = rows.filter((row) => row.fraud_status === "normal");
  return {
    joined: rows.filter((row) => row.fraud_status !== "rejected").length,
    activated: counted.filter((row) => row.activated_at).length,
    retained: counted.filter((row) => row.retained_at).length,
    review: rows.filter((row) => row.fraud_status === "review").length,
    rejected: rows.filter((row) => row.fraud_status === "rejected").length,
  };
}

function useReferralMutation<T>(
  run: (input: T) => Promise<void>,
  successMessage: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral_rows"] });
      queryClient.invalidateQueries({ queryKey: ["referral_rewards"] });
      notify.success(successMessage);
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}

export function useSetReferralFraudStatus() {
  return useReferralMutation<{ id: number; status: string; note?: string | null }>(
    async ({ id, status, note }) => {
      const { error } = await supabase.rpc("referral_set_fraud_status", {
        p_referral_id: id,
        p_status: status,
        p_note: note ?? undefined,
      });
      if (error) throw error;
    },
    "הסטטוס עודכן",
  );
}

export function useMarkRewardPaid() {
  return useReferralMutation<{ id: number; note?: string | null }>(
    async ({ id, note }) => {
      const { error } = await supabase.rpc("referral_mark_reward_paid", {
        p_reward_id: id,
        p_note: note ?? undefined,
      });
      if (error) throw error;
    },
    "ההטבה סומנה כנמסרה",
  );
}

/** The refresh button: runs the same job the hourly cron runs. */
export function useRefreshReferralProgress() {
  return useReferralMutation<{ campaignId: number | null }>(async ({ campaignId }) => {
    const { error } = await supabase.rpc("referral_refresh_now", {
      p_campaign_id: campaignId ?? undefined,
    });
    if (error) throw error;
  }, "הנתונים חושבו מחדש");
}
