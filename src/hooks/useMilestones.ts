import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCoupons } from "@/hooks/useCoupons";
import { loadCelebrationMemory } from "@/lib/celebrationMemory";
import { baselineCelebrationTokens } from "@/lib/celebrationTrigger";
import { milestonesFor, type MilestoneSummary } from "@/lib/milestones";

/**
 * The milestone history: the wallet, and what this device remembers of it.
 *
 * The memory alone was the whole answer, and it is device-local by design —
 * so reinstalling the web app, clearing site data or signing in somewhere new
 * emptied it, and a wallet well past 25 coupons and ₪5,000 saved was shown
 * "we have not passed a milestone yet". The two ladders are a fact about the
 * wallet, which the server has, so they are read from it. What only the device
 * can know — a wallet record, a clean month, an anniversary — still comes from
 * the memory, and is still lost with it.
 */
export function useMilestones() {
  const { data: coupons } = useCoupons();
  // The wallet's own tokens are the query key: passing a step is exactly when
  // this has to be recounted, and nothing else about a coupon changes it.
  const standing = useMemo(() => baselineCelebrationTokens(coupons ?? []), [coupons]);

  return useQuery<MilestoneSummary>({
    queryKey: ["milestones", standing],
    queryFn: async () => milestonesFor(coupons ?? [], (await loadCelebrationMemory()).celebrated ?? []),
    enabled: coupons !== undefined,
    staleTime: 30_000,
  });
}
