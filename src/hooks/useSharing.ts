import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import * as Crypto from "expo-crypto";
import { CouponShare } from "@/integrations/supabase";
import { notify } from "@/lib/notify";
import { decrypt } from "@/lib/encryption";

export type PopulatedShare = CouponShare & {
  coupon: {
    id: number;
    company: string;
    description: string | null;
    value: number;
    used_value: number;
    code: string;
    expiration: string | null;
  };
  shared_by: {
    email: string;
    first_name: string;
    last_name: string;
  };
};

export function useSharedWithMe() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["shared_with_me", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data: publicUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email || "")
        .single();

      if (!publicUser) return [];

      const { data, error } = await supabase
        .from("coupon_shares")
        .select(`
          *,
          coupon:coupon_id (id, company, description, value, used_value, code, expiration),
          shared_by:shared_by_user_id (email, first_name, last_name)
        `)
        .eq("shared_with_user_id", publicUser.id)
        .eq("status", "accepted")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const decryptedData = await Promise.all(
        (data as any[]).map(async (share) => {
          return {
            ...share,
            coupon: {
              ...share.coupon,
              code: await decrypt(share.coupon?.code),
              description: share.coupon?.description ? await decrypt(share.coupon.description) : null,
            },
          };
        })
      );

      return decryptedData as PopulatedShare[];
    },
    enabled: !!user,
  });
}

export function useMyShares() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my_shares", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data: publicUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email || "")
        .single();

      if (!publicUser) return [];

      const { data, error } = await supabase
        .from("coupon_shares")
        .select(`
          *,
          coupon:coupon_id (id, company, description, value, used_value, expiration),
          shared_with:shared_with_user_id (email, first_name, last_name)
        `)
        .eq("shared_by_user_id", publicUser.id)
        // Revoking only flips the status, so revoked shares must be filtered
        // out here or they keep showing up as if the cancel did nothing.
        .neq("status", "revoked")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const decryptedData = await Promise.all(
        (data as any[]).map(async (share) => {
          return {
            ...share,
            coupon: {
              ...share.coupon,
              description: share.coupon?.description ? await decrypt(share.coupon.description) : null,
            },
          };
        })
      );

      return decryptedData;
    },
    enabled: !!user,
  });
}

/**
 * `coupon_shares.share_token` and `share_expires_at` are NOT NULL with no
 * default, so both must be supplied on insert.
 */
const SHARE_EXPIRY_DAYS = 30;

export function useCreateShare() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      couponId,
      recipientEmail,
    }: {
      couponId: number;
      recipientEmail: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // `shared_by_user_id` references public.users.id (an int), not the auth
      // uuid, so the sender has to be resolved the same way the reader is.
      const { data: senderUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email || "")
        .maybeSingle();

      if (!senderUser) throw new Error("לא נמצא משתמש תואם לחשבון שלך");

      const { data: targetUser, error: findError } = await supabase
        .from("users")
        .select("id")
        .eq("email", recipientEmail.trim().toLowerCase())
        .maybeSingle();

      if (findError || !targetUser) {
        throw new Error("משתמש עם אימייל זה לא נמצא במערכת");
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + SHARE_EXPIRY_DAYS);

      const { error: shareError } = await supabase.from("coupon_shares").insert({
        coupon_id: couponId,
        shared_by_user_id: senderUser.id,
        shared_with_user_id: targetUser.id,
        share_token: Crypto.randomUUID(),
        share_expires_at: expiresAt.toISOString(),
        status: "accepted",
        created_at: new Date().toISOString(),
      });

      if (shareError) throw shareError;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_shares"] });
    },
    onError: (error: any) => {
      notify.error("שגיאה בשיתוף הקופון", error.message);
    },
  });
}

export function useRevokeShare() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (shareId: number) => {
      if (!user) throw new Error("Not authenticated");

      // Returning the row makes an RLS-blocked update surface as an error
      // instead of a silent no-op that still reports success.
      const { data, error } = await supabase
        .from("coupon_shares")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
        })
        .eq("id", shareId)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("אין לך הרשאה לבטל את השיתוף הזה");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_shares"] });
    },
    onError: (error: any) => {
      notify.error("שגיאה בביטול השיתוף", error.message);
    },
  });
}
