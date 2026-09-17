import { useQuery } from "@tanstack/react-query";
import { loadCelebrationMemory } from "@/lib/celebrationMemory";
import { summariseMilestones, type MilestoneSummary } from "@/lib/milestones";

/**
 * The milestone history, read from the device's own celebration memory.
 *
 * Local by design, like the memory it reads: this is presentation state the
 * server never needed. It is cleared on sign-out with the rest of the local
 * private data.
 */
export function useMilestones() {
  return useQuery<MilestoneSummary>({
    queryKey: ["milestones"],
    queryFn: async () => summariseMilestones((await loadCelebrationMemory()).celebrated ?? []),
    staleTime: 30_000,
  });
}
