import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";

export type ReferralApplication = {
  id: number;
  user_id: number | null;
  full_name: string;
  email: string;
  phone: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export function useMyApplication() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["my_referral_application", session?.id],
    queryFn: async (): Promise<ReferralApplication | null> => {
      const { data, error } = await (supabase.from as any)("referral_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data as ReferralApplication[])?.[0] ?? null;
    },
    enabled: Boolean(session),
  });
}

export function useSubmitApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fullName: string; email: string; phone?: string; reason?: string }) => {
      const { data, error } = await (supabase.rpc as any)("referral_apply", {
        p_full_name: input.fullName,
        p_email: input.email,
        p_phone: input.phone ?? null,
        p_reason: input.reason ?? null,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["my_referral_application"] });
      notify.success("הבקשה נשלחה בהצלחה");
      supabase.functions.invoke("send-emails", {
        body: {
          mode: "referral_application",
          full_name: input.fullName,
          email: input.email,
          phone: input.phone ?? "",
          reason: input.reason ?? "",
        },
      }).catch(() => {});
    },
    onError: (e: any) => {
      if (e.message?.includes("already a partner")) {
        notify.error("שגיאה", "את/ה כבר שותף/ה פעיל/ה");
      } else if (e.message?.includes("already pending")) {
        notify.error("שגיאה", "יש כבר בקשה ממתינה");
      } else {
        notify.error("שגיאה", e.message);
      }
    },
  });
}

export function useReferralApplications() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ["referral_applications_admin"],
    queryFn: async (): Promise<ReferralApplication[]> => {
      const { data, error } = await (supabase.from as any)("referral_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReferralApplication[];
    },
    enabled: isAdmin,
  });
}

export function useReviewApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; status: "approved" | "rejected"; note?: string }) => {
      const { error } = await (supabase.rpc as any)("referral_review_application", {
        p_application_id: input.id,
        p_status: input.status,
        p_note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral_applications_admin"] });
      notify.success("הבקשה עודכנה");
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}
