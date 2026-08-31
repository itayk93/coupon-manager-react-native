import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { CouponShare } from "@/integrations/supabase";
import { notify } from "@/lib/notify";
import { couponVault } from "@/lib/couponVault";
import { logActivity } from "@/lib/activityLog";
import type { SaleInput } from "@/hooks/useCouponSales";

export type PopulatedShare = CouponShare & {
  coupon: { id: number; public_id?: string | null; company: string; description: string | null; value: number; used_value: number; code: string | null; expiration: string | null };
  shared_by: { email: string; first_name: string; last_name: string };
};

export type ShareType = "shared" | "transfer";

export function useSharedWithMe() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["shared_with_me", user?.id], queryFn: async () => {
    if (!user) throw new Error("Not authenticated");
    return couponVault<PopulatedShare[]>({ action: "shared_with_me" });
  }, enabled: !!user });
}

export function useMyShares() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["my_shares", user?.id], queryFn: async () => {
    if (!user) throw new Error("Not authenticated");
    return couponVault<any[]>({ action: "my_shares" });
  }, enabled: !!user });
}

export function useCreateShare() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ couponId, recipientEmail, shareType, sale }: { couponId: number; recipientEmail: string; shareType: ShareType; sale?: SaleInput }) => {
      if (!user) throw new Error("Not authenticated");
      return couponVault<{ id: number; emailSent: boolean }>({ action: "create_share", couponId, recipientEmail, shareType, sale });
    },
    onSuccess: (result, { couponId }) => {
      // The recipient's address is deliberately not recorded.
      logActivity("share_coupon", { couponId });
      queryClient.invalidateQueries({ queryKey: ["my_shares"] });
      if (result.emailSent) notify.success("הזמנת השיתוף נשלחה במייל");
      else notify.error("השיתוף נשמר, אך שליחת המייל נכשלה");
    },
    onError: (error: any) => notify.error("שגיאה בשיתוף הקופון", error.message),
  });
}

export function useRespondToShare() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ shareId, accept }: { shareId: number; accept: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      return couponVault({ action: "respond_to_share", id: shareId, accept });
    },
    onSuccess: (_result, { accept }) => {
      queryClient.invalidateQueries({ queryKey: ["shared_with_me"] });
      queryClient.invalidateQueries({ queryKey: ["my_shares"] });
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      notify.success(accept ? "השיתוף אושר" : "ההזמנה נדחתה");
    },
    onError: (error: any) => notify.error("שגיאה במענה לשיתוף", error.message),
  });
}

export function useRevokeShare() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (shareId: number) => {
      if (!user) throw new Error("Not authenticated");
      await couponVault({ action: "revoke_share", id: shareId });
      return true;
    },
    onSuccess: (_result, shareId) => {
      logActivity("revoke_share", { metadata: { share_id: shareId } });
      queryClient.invalidateQueries({ queryKey: ["my_shares"] });
    },
    onError: (error: any) => notify.error("שגיאה בביטול השיתוף", error.message),
  });
}
