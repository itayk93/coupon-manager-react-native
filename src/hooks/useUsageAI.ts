import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

export type ParsedUsage = {
  id: string;
  amount: number;
  placeName: string;
  usedAt: string | null;
  details: string;
  placeAddress: string;
  latitude: number | null;
  longitude: number | null;
};

export function useParseUsageScreenshot() {
  return useMutation({
    mutationFn: async (imageBase64: string): Promise<ParsedUsage[]> => {
      const { data, error } = await supabase.functions.invoke("parse-usage-screenshot", {
        body: { imageBase64 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.usages) || data.usages.length === 0) {
        throw new Error("לא זוהו שימושים בצילום המסך");
      }

      return Promise.all(
        data.usages.map(async (usage: any, index: number) => {
          const placeName = String(usage.placeName || "").trim();
          let placeAddress = "";
          let latitude: number | null = null;
          let longitude: number | null = null;

          if (placeName) {
            const result = await supabase.functions.invoke("geocode-address", {
              body: { query: placeName },
            });
            if (!result.error && result.data?.result) {
              placeAddress = result.data.result.address || "";
              latitude = result.data.result.latitude ?? null;
              longitude = result.data.result.longitude ?? null;
            }
          }

          return {
            id: `${Date.now()}-${index}`,
            amount: Number(usage.amount) || 0,
            placeName,
            usedAt: usage.usedAt || null,
            details: String(usage.details || "שימוש שזוהה מצילום מסך"),
            placeAddress,
            latitude,
            longitude,
          };
        })
      );
    },
    onError: (error: any) => notify.error("לא הצלחנו לפענח את הצילום", error.message),
  });
}
