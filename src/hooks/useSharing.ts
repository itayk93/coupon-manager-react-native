import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { CouponShare } from "@/integrations/supabase";
import { notify } from "@/lib/notify";
import { couponVault } from "@/lib/couponVault";

export type PopulatedShare = CouponShare & {
  coupon: { id: number; company: string; description: string | null; value: number; used_value: number; code: string; expiration: string | null };
  shared_by: { email: string; first_name: string; last_name: string };
};

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
    mutationFn: async ({ couponId, recipientEmail }: { couponId: number; recipientEmail: string }) => {
      if (!user) throw new Error("Not authenticated");
      await couponVault({ action: "create_share", couponId, recipientEmail });
      return true;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my_shares"] }),
    onError: (error: any) => notify.error("שגיאה בשיתוף הקופון", error.message),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my_shares"] }),
    onError: (error: any) => notify.error("שגיאה בביטול השיתוף", error.message),
  });
}
