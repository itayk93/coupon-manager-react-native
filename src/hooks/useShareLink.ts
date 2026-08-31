import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { couponVault } from "@/lib/couponVault";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activityLog";
import type { ShareType } from "@/hooks/useSharing";

export type ShareLink = {
  id: number;
  token: string;
  shareType: ShareType;
  expiresAt: string;
};

export type ShareLinkPreview = {
  company: string;
  description: string | null;
  value: number;
  usedValue: number;
  expiration: string | null;
  shareType: ShareType;
  senderFirstName: string | null;
  isOwnLink: boolean;
  expiresAt: string;
};

const LINK_ERRORS: Record<string, string> = {
  SHARE_LINK_INVALID: "הקישור פג תוקף או שכבר נעשה בו שימוש",
  SHARE_ALREADY_CLAIMED: "מישהו אחר כבר לקח את הקופון הזה",
  SHARE_ALREADY_EXISTS: "הקופון הזה כבר משותף איתך",
  CANNOT_CLAIM_OWN_SHARE: "זה הקישור שלך — שלח אותו למישהו אחר",
  NOT_FOUND: "הקופון לא נמצא",
};

export function shareLinkErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return LINK_ERRORS[raw] || "משהו השתבש. נסה שוב";
}

export function useCreateShareLink() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ couponId, shareType }: { couponId: number; shareType: ShareType }) => {
      if (!user) throw new Error("Not authenticated");
      return couponVault<ShareLink>({ action: "create_share_link", couponId, shareType });
    },
    onSuccess: (_link, { couponId }) => {
      // Who ends up holding the link is unknowable by design, so only the fact
      // that one was minted is recorded.
      logActivity("share_coupon", { couponId });
      queryClient.invalidateQueries({ queryKey: ["my_shares"] });
    },
    onError: (error: unknown) => notify.error("לא הצלחנו ליצור קישור שיתוף", shareLinkErrorMessage(error)),
  });
}

export function useShareLinkPreview(token: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["share_link_preview", token],
    queryFn: async () => couponVault<ShareLinkPreview>({ action: "share_link_preview", token }),
    enabled: !!user && !!token,
    // A one-shot credential must not be answered from a stale cache: the link
    // may have been claimed by someone else since this screen last opened.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useClaimShareLink() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ token, accept }: { token: string; accept: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      return couponVault<{ status: string; couponId: number }>({
        action: "claim_share_link",
        token,
        accept,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["shared_with_me"] });
      queryClient.invalidateQueries({ queryKey: ["my_shares"] });
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      if (result.status === "declined") return;
      notify.success(result.status === "transferred" ? "הקופון הועבר אליך" : "הקופון שותף איתך");
    },
    onError: (error: unknown) => notify.error("לא הצלחנו לקבל את הקופון", shareLinkErrorMessage(error)),
  });
}
