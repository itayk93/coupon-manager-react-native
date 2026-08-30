import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type GeoRange = 30 | 90;

export type GeoRow = {
  region: string;
  city: string;
  users: number;
  events: number;
};

/**
 * City/region breakdown of activity, admin only. The location is stamped onto
 * each user_activities row by the enrich-ip-geo cron, so this is a plain
 * GROUP BY behind admin_geo_breakdown() - no join, no IP exposure.
 */
export function useGeoAnalytics(days: GeoRange) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ["geo_analytics", days],
    enabled: isAdmin,
    queryFn: async (): Promise<GeoRow[]> => {
      const { data, error } = await supabase.rpc("admin_geo_breakdown", { p_days: days });
      if (error) throw error;
      return (data ?? []) as GeoRow[];
    },
  });
}
