import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MyReferralStatus = {
  code: string;
};

/**
 * The signed-in person's own invite code. The code, and nothing else.
 *
 * Deliberately not how many people joined underneath them: that is the number
 * the pilot pays on, it belongs to the admin tab, and a partner watching it
 * move turns every reward into a negotiation. The server returns one column
 * for the same reason.
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
