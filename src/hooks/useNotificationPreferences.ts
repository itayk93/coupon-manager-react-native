import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";
import { NOTIFICATION_PREFERENCES_COLUMNS } from "@/lib/tableColumns";
import { DEFAULT_NOTIFICATION_WINDOWS } from "@/lib/notificationWindows";
import type { TypeChannels } from "@/lib/notificationTypes";

export type NotificationPreferences = {
  user_id: number;
  email: boolean;
  push: boolean;
  in_app: boolean;
  windows: number[];
  quiet_until: string | null;
  timezone: string;
  /** Remind every day once a coupon is this close to expiry. null = off. */
  daily_within: number | null;
  /**
   * Per-kind channel choices. An absent kind, or an absent channel inside one,
   * means "whatever that kind defaults to" — so a kind added on the server
   * reaches people who have never opened this screen.
   */
  type_channels: TypeChannels;
};

const PREFERENCE_COLUMNS = NOTIFICATION_PREFERENCES_COLUMNS;

const DEFAULTS: NotificationPreferences = {
  user_id: 0,
  email: true,
  push: true,
  in_app: true,
  windows: DEFAULT_NOTIFICATION_WINDOWS,
  quiet_until: null,
  timezone: "Asia/Jerusalem",
  daily_within: null,
  type_channels: {},
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notification_preferences", user?.id],
    queryFn: async () => {
      if (!user) return DEFAULTS;
      const { data, error } = await supabase
        .from("notification_preferences")
        .select(PREFERENCE_COLUMNS)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as NotificationPreferences | null) ?? { ...DEFAULTS, user_id: user.id };
    },
    enabled: !!user,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" })
        .select(PREFERENCE_COLUMNS)
        .single();
      if (error) throw error;
      return data as NotificationPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_preferences"] });
    },
    onError: (error: any) => {
      notify.error("שגיאה בעדכון העדפות ההתראות", error.message);
    },
  });
}
