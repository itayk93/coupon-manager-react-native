import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";
import { FEATURE_ACCESS_COLUMNS, USER_FEATURE_OVERRIDES_COLUMNS } from "@/lib/tableColumns";

export const FEATURE_KEYS = [
  "dashboard",
  "coupons",
  "bulk_import",
  "bulk_delete",
  "auto_update",
  "statistics",
  "sharing",
  "notifications",
  "profile",
  "settings",
  "onboarding",
  "ai_parse",
  "admin",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
type AccessMode = "all" | "admin" | "disabled";

type FeatureOverrideRow = {
  id: number;
  user_id: number;
  feature_key: string;
  is_enabled: boolean;
};

function isFeatureKey(value: string): value is FeatureKey {
  return FEATURE_KEYS.includes(value as FeatureKey);
}

function resolveGlobalAccess(accessMode: string | null | undefined, isAdmin: boolean) {
  const mode = (accessMode ?? "all") as AccessMode;
  if (mode === "disabled") return false;
  if (mode === "admin") return isAdmin;
  return true;
}

export function useFeatureCatalog() {
  return useQuery({
    queryKey: ["feature_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_access")
        .select(FEATURE_ACCESS_COLUMNS)
        .order("feature_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useUserFeatureOverrides(targetUserId?: number) {
  return useQuery({
    queryKey: ["user_feature_overrides", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      const { data, error } = await supabase
        .from("user_feature_overrides" as any)
        .select(USER_FEATURE_OVERRIDES_COLUMNS)
        .eq("user_id", targetUserId)
        .order("feature_key", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FeatureOverrideRow[];
    },
    enabled: Boolean(targetUserId),
  });
}

export function useFeatureAccess() {
  const { user, isAdmin } = useAuth();
  const { data: catalog = [] } = useFeatureCatalog();
  const { data: overrides = [] } = useUserFeatureOverrides(user?.id);

  const featureMap = useMemo(() => {
    const globalMap = new Map<FeatureKey, boolean>();
    const overrideMap = new Map<FeatureKey, boolean>();

    FEATURE_KEYS.forEach((key) => globalMap.set(key, true));

    catalog.forEach((row) => {
      if (isFeatureKey(row.feature_name)) {
        globalMap.set(row.feature_name, resolveGlobalAccess(row.access_mode, isAdmin));
      }
    });

    overrides.forEach((row) => {
      if (isFeatureKey(row.feature_key)) {
        overrideMap.set(row.feature_key, Boolean(row.is_enabled));
      }
    });

    return FEATURE_KEYS.reduce((acc, key) => {
      acc[key] = overrideMap.has(key) ? Boolean(overrideMap.get(key)) : Boolean(globalMap.get(key));
      return acc;
    }, {} as Record<FeatureKey, boolean>);
  }, [catalog, overrides, isAdmin]);

  return {
    features: featureMap,
    hasFeature: (featureKey: FeatureKey) => Boolean(featureMap[featureKey]),
  };
}

export function useUpsertFeatureAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ featureName, accessMode }: { featureName: FeatureKey; accessMode: AccessMode }) => {
      const { error } = await supabase
        .from("feature_access")
        .upsert(
          { feature_name: featureName, access_mode: accessMode },
          { onConflict: "feature_name" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("ברירת המחדל לפיצ׳ר נשמרה");
      queryClient.invalidateQueries({ queryKey: ["feature_catalog"] });
    },
    onError: (error: any) => {
      notify.error("שגיאה בשמירת פיצ׳ר", error.message);
    },
  });
}

export function useUpsertUserFeatureOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      featureKey,
      isEnabled,
    }: {
      userId: number;
      featureKey: FeatureKey;
      isEnabled: boolean;
    }) => {
      const { error } = await supabase
        .from("user_feature_overrides" as any)
        .upsert(
          {
            user_id: userId,
            feature_key: featureKey,
            is_enabled: isEnabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,feature_key" }
        );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      notify.success("הרשאת הפיצ׳ר נשמרה");
      queryClient.invalidateQueries({ queryKey: ["user_feature_overrides", variables.userId] });
    },
    onError: (error: any) => {
      notify.error("שגיאה בשמירת הרשאה", error.message);
    },
  });
}
