import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { NOTIFICATIONS_COLUMNS } from "@/lib/tableColumns";
import { Notification } from "@/integrations/supabase";

export function useInAppNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["in_app_notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select(NOTIFICATIONS_COLUMNS)
        .eq("user_id", user.id)
        .eq("hide_from_view", false)
        .order("timestamp", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!user,
  });
}

export function useMarkNotificationViewed() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("notifications")
        .update({ viewed: true, shown: true })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["in_app_notifications"] });
    },
  });
}
