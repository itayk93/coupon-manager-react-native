import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MyReferralStatus = {
  code: string;
  joined: number;
  activated: number;
  retained: number;
};

/**
 * The signed-in person's own invite code and how their chain is doing.
 *
 * Returns null for anyone outside a campaign, and that is what keeps the pilot
 * closed: a code only exists once the server has attributed someone to a
 * chain, so the invite screen has nothing to show and hides itself. Opening
 * referrals to everyone later is a row in `referral_codes`, not a release.
 */
export function useMyReferralStatus() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["my_referral_status", session?.id],
    queryFn: async (): Promise<MyReferralStatus | null> => {
      const { data, error } = await supabase.rpc("my_referral_status");
      if (error) throw error;
      return (data as MyReferralStatus[])?.[0] ?? null;
    },
    enabled: Boolean(session),
    staleTime: 60_000,
  });
}
