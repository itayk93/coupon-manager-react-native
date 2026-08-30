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

export type ParsedUsageScreenshot = {
  couponCode: string | null;
  couponCodeConfidence: number;
  companyName: string | null;
  warnings: string[];
  usages: ParsedUsage[];
};

async function readableFunctionError(error: any): Promise<string> {
  const fallback = "פענוח התמונה נכשל. אפשר לבחור קופון ולהזין שימוש ידנית.";
  const response = error?.context;
  if (response && typeof response.json === "function") {
    try {
      const body = await response.clone().json();
      if (typeof body?.error === "string" && body.error.trim()) return body.error.trim();
    } catch {
      // Fall through to a user-facing fallback below.
    }
  }
  if (typeof error?.message === "string" && !error.message.includes("non-2xx")) return error.message;
  return fallback;
}

export function useParseUsageScreenshot() {
  return useMutation({
    mutationFn: async (imageBase64: string): Promise<ParsedUsageScreenshot> => {
      const { data, error } = await supabase.functions.invoke("parse-usage-screenshot", {
        body: { imageBase64 },
      });
      if (error) throw new Error(await readableFunctionError(error));
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.usages) || data.usages.length === 0) {
        throw new Error("לא זוהו שימושים בצילום המסך");
      }

      const placeQueries = [...new Set(data.usages.map((usage: any) => String(usage.placeName || "").trim()).filter(Boolean))] as string[];
      const places = new Map<string, { placeAddress: string; latitude: number | null; longitude: number | null }>();
      await Promise.all(placeQueries.map(async (placeName) => {
        const result = await supabase.functions.invoke("geocode-address", { body: { query: placeName } });
        places.set(placeName, {
          placeAddress: !result.error && result.data?.result ? result.data.result.address || "" : "",
          latitude: !result.error && result.data?.result ? result.data.result.latitude ?? null : null,
          longitude: !result.error && result.data?.result ? result.data.result.longitude ?? null : null,
        });
      }));

      const usages = data.usages.map((usage: any, index: number) => {
          const placeName = String(usage.placeName || "").trim();
          const place = places.get(placeName);

          return {
            id: `${Date.now()}-${index}`,
            amount: Number(usage.amount) || 0,
            placeName,
            usedAt: usage.usedAt || null,
            details: String(usage.details || "שימוש שזוהה מצילום מסך"),
            placeAddress: place?.placeAddress || "",
            latitude: place?.latitude ?? null,
            longitude: place?.longitude ?? null,
          };
        });
      return {
        couponCode: typeof data.couponCode === "string" ? data.couponCode.trim() : null,
        couponCodeConfidence: Number(data.couponCodeConfidence) || 0,
        companyName: typeof data.companyName === "string" ? data.companyName.trim() : null,
        warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
        usages,
      };
    },
    onError: (error: any) => notify.error("לא הצלחנו לפענח את הצילום", error.message),
  });
}
