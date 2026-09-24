import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Coupon } from "@/integrations/supabase";
import { matchCompanyName } from "@/lib/companyMatch";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";
import { couponVault } from "@/lib/couponVault";
import { logActivity } from "@/lib/activityLog";
import { loadOfflineCoupons, saveOfflineCoupons } from "@/lib/offlineCoupons";
import { mergeCouponIntoWallet } from "@/lib/walletCache";

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

/**
 * How long a fetched wallet counts as fresh. Every list call makes the vault
 * decrypt every coupon, and over twenty screens read this query — without a
 * window each screen change refetched the whole wallet. Edits made in the app
 * write straight into the cache, pull-to-refresh bypasses the window, and
 * server-side changes (usage, sales, auto-update) still invalidate it.
 */
export const COUPONS_STALE_TIME = 5 * 60 * 1000;

/**
 * Puts the coupon the vault returned into the cached wallet, in place of the
 * old copy (or at the top when new), so a single edit does not refetch and
 * re-decrypt the whole list.
 */
function writeCouponToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: number | undefined,
  coupon: DecryptedCoupon
) {
  const wallet = queryClient.setQueryData<DecryptedCoupon[]>(["coupons", userId], (current) =>
    current ? mergeCouponIntoWallet(current, coupon) : current
  );
  // No refetch follows any more, so the offline mirror is refreshed here —
  // otherwise a wallet opened without signal would show the pre-edit copy.
  if (wallet && userId !== undefined) void saveOfflineCoupons(userId, wallet);

  // The detail screen keys the coupon by its public id or its numeric id,
  // whichever the route carried, so match on the coupon itself.
  queryClient.setQueriesData<DecryptedCoupon>(
    { queryKey: ["coupon"], predicate: (query) => (query.state.data as DecryptedCoupon | undefined)?.id === coupon.id },
    (current) => (current ? { ...coupon, is_shared_with_me: current.is_shared_with_me } : current)
  );
}

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
    staleTime: COUPONS_STALE_TIME,
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

  const queryClient = useQueryClient();

  // The wallet list holds the same decrypted row the vault's "get" returns, so
  // a coupon opened from the list starts from it instead of asking the vault
  // to decrypt it again. It counts as fresh for as long as the list does; a
  // coupon that is not in the list (a deep link, a trashed one) still fetches.
  const fromWallet = () => {
    if (!user || !hasValidIdentifier) return undefined;
    const coupons = queryClient.getQueryData<DecryptedCoupon[]>(["coupons", user.id]);
    return coupons?.find((c) => (publicId !== undefined ? c.public_id === publicId : c.id === legacyId));
  };

  return useQuery({
    queryKey: ["coupon", couponIdentifier],
    queryFn: async () => {
      if (!user || !hasValidIdentifier) throw new Error("Invalid request");

      return couponVault<DecryptedCoupon>({ action: "get", id: legacyId, publicId });
    },
    enabled: !!user && hasValidIdentifier,
    initialData: fromWallet,
    initialDataUpdatedAt: () =>
      user ? queryClient.getQueryState(["coupons", user.id])?.dataUpdatedAt : undefined,
    staleTime: COUPONS_STALE_TIME,
  });
}

/**
 * Marks one coupon's detail query stale, whichever id its route used. The
 * detail is keyed by the route's identifier — usually the public `cpn_` id —
 * so invalidating `["coupon", numericId]` alone never reached it.
 */
export function invalidateCouponDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  couponId: number
) {
  return queryClient.invalidateQueries({
    queryKey: ["coupon"],
    predicate: (query) =>
      query.queryKey[1] === couponId ||
      (query.state.data as DecryptedCoupon | undefined)?.id === couponId,
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
        // The column defaults to true, and since 20260831080000 the database
        // rejects an auto-updating coupon from anyone but the maintainer — so
        // a caller that did not ask for it (bulk import, the onboarding coupon)
        // had every insert fail. Only the add form opts in, explicitly.
        auto_update: newCoupon.auto_update ?? false,
      };

      return couponVault<DecryptedCoupon>({ action: "create", coupon: couponToInsert });
    },
    onSuccess: (created) => {
      logActivity("add_coupon_submit", {
        couponId: (created as any)?.id ?? null,
        metadata: { company: String((created as any)?.company || "") },
      });
      // The vault returns the stored, decrypted row, so the cache can take it
      // as is — no need to fetch the whole wallet again.
      const coupon = { ...created, is_shared_with_me: false };
      // With no wallet loaded yet there is nothing to patch, and a one-coupon
      // list would hide the rest, so fetch it instead.
      if (queryClient.getQueryData(["coupons", user?.id])) {
        writeCouponToCache(queryClient, user?.id, coupon);
      } else {
        queryClient.invalidateQueries({ queryKey: ["coupons", user?.id] });
      }
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
      // The server state is unknown after a failure, so resync from it.
      queryClient.invalidateQueries({ queryKey: ["coupons", user?.id] });
      invalidateCouponDetail(queryClient, id);
      notify.error("שגיאה בעדכון הקופון", error.message);
    },
    onSuccess: (updated, { id, updates }) => {
      // Replace the optimistic copy with what the vault actually stored.
      writeCouponToCache(queryClient, user?.id, updated);
      // Which fields changed, never their values — an edit to a code must not
      // put the code in the activity log.
      logActivity("edit_coupon_submit", {
        couponId: id,
        metadata: { fields: Object.keys(updates).join(",") },
      });
    },
  });
}

/**
 * Coupons the user moved to the trash. Kept for 30 days, then the
 * purge_soft_deleted_coupons() cron job hard-deletes them.
 */
export function useDeletedCoupons() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["coupons", "deleted", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      return couponVault<DecryptedCoupon[]>({ action: "list_deleted" });
    },
    enabled: !!user,
  });
}

/** How long a soft-deleted coupon survives before the nightly purge. */
export const TRASH_RETENTION_DAYS = 30;

// Soft delete: the coupon moves to "recently deleted" and drops out of every
// list. Undo restores it; the trash screen restores it later.
export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: number) => {
      if (!user) throw new Error("Not authenticated");
      await couponVault({ action: "soft_delete", ids: [id] });
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

/** Pull coupons back out of the trash. */
export function useRestoreCoupons() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      if (!user) throw new Error("Not authenticated");
      if (!ids.length) return 0;
      const result = await couponVault<{ ids: number[] }>({ action: "restore", ids });
      return result.ids.length;
    },
    onSuccess: (count) => {
      logActivity("restore_coupon", { metadata: { count } });
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (error: any) => {
      notify.error("שגיאה בשחזור הקופון", error.message);
    },
  });
}

/** Permanently remove coupons that are already in the trash. */
export function usePermanentDeleteCoupons() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      if (!user) throw new Error("Not authenticated");
      if (!ids.length) return 0;
      const result = await couponVault<{ ids: number[] }>({ action: "hard_delete", ids });
      return result.ids.length;
    },
    onSuccess: (count) => {
      logActivity("purge_coupon", { metadata: { count } });
      queryClient.invalidateQueries({ queryKey: ["coupons", "deleted"] });
    },
    onError: (error: any) => {
      notify.error("שגיאה במחיקה לצמיתות", error.message);
    },
  });
}
