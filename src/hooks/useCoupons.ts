import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Coupon } from "@/integrations/supabase";
import { matchCompanyName } from "@/lib/companyMatch";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";
import { couponVault } from "@/lib/couponVault";
import { logActivity } from "@/lib/activityLog";
import { loadOfflineCoupons, saveOfflineCoupons } from "@/lib/offlineCoupons";

export type DecryptedCoupon = Omit<
  Coupon,
  | "code"
  | "description"
  | "buyme_coupon_url"
  | "strauss_coupon_url"
  | "xgiftcard_coupon_url"
  | "xtra_coupon_url"
  | "cvv"
  | "card_exp"
> & {
  code: string;
  description: string | null;
  buyme_coupon_url: string | null;
  strauss_coupon_url: string | null;
  xgiftcard_coupon_url: string | null;
  xtra_coupon_url: string | null;
  cvv: string | null;
  card_exp: string | null;
  is_shared_with_me?: boolean;
};

// Helper function to decrypt a single coupon
export function useCoupons() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["coupons", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      try {
        const coupons = await couponVault<DecryptedCoupon[]>({ action: "list" });
        void saveOfflineCoupons(user.id, coupons);
        return coupons;
      } catch (error) {
        // No connection is the common case here, and a wallet the user cannot
        // open in a shop is worse than a slightly stale one. Fall back to the
        // last mirrored list; if there is none, the error stands.
        const cached = await loadOfflineCoupons(user.id);
        if (cached) return cached;
        throw error;
      }
    },
    enabled: !!user,
  });
}

export function useCoupon(couponIdentifier: string | number | undefined) {
  const { user } = useAuth();
  const publicId = typeof couponIdentifier === "string" && couponIdentifier.startsWith("cpn_")
    ? couponIdentifier
    : undefined;
  const legacyId = publicId === undefined && couponIdentifier !== undefined
    ? Number(couponIdentifier)
    : undefined;
  const hasValidIdentifier = publicId !== undefined
    || (Number.isSafeInteger(legacyId) && (legacyId as number) > 0);

  return useQuery({
    queryKey: ["coupon", couponIdentifier],
    queryFn: async () => {
      if (!user || !hasValidIdentifier) throw new Error("Invalid request");

      return couponVault<DecryptedCoupon>({ action: "get", id: legacyId, publicId });
    },
    enabled: !!user && hasValidIdentifier,
  });
}

/**
 * Company names the app already knows about: the admin `companies` table plus the
 * distinct companies on the user's own coupons, read straight out of the query
 * cache so this stays synchronous.
 */
function knownCompanyNames(queryClient: ReturnType<typeof useQueryClient>): string[] {
  const names = new Set<string>();

  const companies = queryClient.getQueryData<{ name?: string | null }[]>(["companies"]);
  (companies || []).forEach((company) => {
    const name = company?.name?.trim();
    if (name) names.add(name);
  });

  queryClient
    .getQueriesData<DecryptedCoupon[]>({ queryKey: ["coupons"] })
    .forEach(([, coupons]) => {
      (coupons || []).forEach((coupon) => {
        const name = coupon?.company?.trim();
        if (name) names.add(name);
      });
    });

  return Array.from(names);
}

/**
 * Snaps a company name onto the spelling already in use, so a differently-cased
 * detection ("BUYME" out of the AI parser) cannot open a second company card next
 * to the existing one — the dashboard groups by exact name.
 */
function canonicalCompany(
  company: string | null | undefined,
  queryClient: ReturnType<typeof useQueryClient>
): string | null | undefined {
  const detected = company?.trim();
  if (!detected) return company;
  return matchCompanyName(detected, knownCompanyNames(queryClient)) || detected;
}

export function useAddCoupon() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (newCoupon: Partial<DecryptedCoupon>) => {
      if (!user) throw new Error("Not authenticated");

      const expiration = newCoupon.expiration
        ? (newCoupon.expiration.includes("T") ? newCoupon.expiration.split("T")[0] : newCoupon.expiration).slice(0, 10)
        : null;

      const couponToInsert = {
        ...(newCoupon as any),
        user_id: user.id,
        company: canonicalCompany(newCoupon.company, queryClient),
        expiration,
        date_added: new Date().toISOString(),
        used_value: newCoupon.used_value || 0,
        status: newCoupon.status || "פעיל",
      };

      return couponVault<DecryptedCoupon>({ action: "create", coupon: couponToInsert });
    },
    onSuccess: (created) => {
      logActivity("add_coupon_submit", {
        couponId: (created as any)?.id ?? null,
        metadata: { company: String((created as any)?.company || "") },
      });
      queryClient.setQueryData<DecryptedCoupon[]>(["coupons", user?.id], (current) => {
        if (!current) return [created];
        if (current.some((coupon) => coupon.id === created.id)) return current;
        return [created, ...current];
      });
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (error: any) => {
      notify.error("שגיאה בהוספת הקופון", error.message);
    },
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<DecryptedCoupon> }) => {
      if (!user) throw new Error("Not authenticated");

      const normalizedUpdates: Record<string, unknown> = { ...updates };

      if (updates.company !== undefined) {
        normalizedUpdates.company = canonicalCompany(updates.company, queryClient);
      }
      if (updates.expiration !== undefined) {
        normalizedUpdates.expiration = updates.expiration
          ? (updates.expiration.includes("T") ? updates.expiration.split("T")[0] : updates.expiration).slice(0, 10)
          : null;
      }

      return couponVault<DecryptedCoupon>({ action: "update", id, updates: normalizedUpdates });
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["coupons"] });
      await queryClient.cancelQueries({ queryKey: ["coupon", id] });

      const previousCoupons = queryClient.getQueryData<DecryptedCoupon[]>(["coupons", user?.id]);
      const previousCoupon = queryClient.getQueryData<DecryptedCoupon>(["coupon", id]);

      if (previousCoupons) {
        queryClient.setQueryData<DecryptedCoupon[]>(
          ["coupons", user?.id],
          previousCoupons.map((c) => (c.id === id ? { ...c, ...updates } : c))
        );
      }

      if (previousCoupon) {
        queryClient.setQueryData<DecryptedCoupon>(["coupon", id], {
          ...previousCoupon,
          ...updates,
        });
      }

      return { previousCoupons, previousCoupon };
    },
    onError: (error: any, { id }, context) => {
      if (context?.previousCoupons) {
        queryClient.setQueryData(["coupons", user?.id], context.previousCoupons);
      }
      if (context?.previousCoupon) {
        queryClient.setQueryData(["coupon", id], context.previousCoupon);
      }
      notify.error("שגיאה בעדכון הקופון", error.message);
    },
    onSuccess: (_data, { id, updates }) => {
      // Which fields changed, never their values — an edit to a code must not
      // put the code in the activity log.
      logActivity("edit_coupon_submit", {
        couponId: id,
        metadata: { fields: Object.keys(updates).join(",") },
      });
    },
    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      queryClient.invalidateQueries({ queryKey: ["coupon", id] });
    },
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: number) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("coupon")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      return true;
    },
    onSuccess: (_result, id) => {
      logActivity("delete_coupon", { couponId: id });
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (error: any) => {
      notify.error("שגיאה במחיקת הקופון", error.message);
    },
  });
}

export function useBulkDeleteCoupons() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      if (!user) throw new Error("Not authenticated");
      if (!ids.length) return 0;

      const { error, count } = await supabase
        .from("coupon")
        .delete({ count: "exact" })
        .in("id", ids)
        .eq("user_id", user.id);

      if (error) throw error;
      return count ?? ids.length;
    },
    onSuccess: (deletedCount) => {
      logActivity("delete_coupon", { metadata: { bulk: true, count: deletedCount } });
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (error: any) => {
      notify.error("שגיאה במחיקה מרובה", error.message);
    },
  });
}
