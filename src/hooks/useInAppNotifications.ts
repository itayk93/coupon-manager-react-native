import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { NOTIFICATIONS_COLUMNS } from "@/lib/tableColumns";
import { Notification } from "@/integrations/supabase";

type QueryClient = ReturnType<typeof useQueryClient>;

/**
 * Applies a change to the cached feed before the server answers, and returns
 * a rollback for when it refuses.
 */
async function optimisticFeed(
  queryClient: QueryClient,
  userId: number | undefined,
  change: (feed: Notification[]) => Notification[]
) {
  const key = ["in_app_notifications", userId];
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<Notification[]>(key);
  if (previous) queryClient.setQueryData<Notification[]>(key, change(previous));
  return { previous };
}

function rollbackFeed(queryClient: QueryClient, userId: number | undefined, context?: { previous?: Notification[] }) {
  if (context?.previous) queryClient.setQueryData(["in_app_notifications", userId], context.previous);
}

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
    onMutate: (id) =>
      optimisticFeed(queryClient, user?.id, (feed) =>
        feed.map((n) => (n.id === id ? { ...n, viewed: true, shown: true } : n))
      ),
    onError: (_error, _id, context) => rollbackFeed(queryClient, user?.id, context),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["in_app_notifications"] });
    },
  });
}

/** Marks every visible notification as read in one server update. */
export function useMarkAllNotificationsViewed() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("notifications")
        .update({ viewed: true, shown: true })
        .eq("user_id", user.id)
        .eq("hide_from_view", false)
        .not("viewed", "is", true);
      if (error) throw error;
    },
    onMutate: () =>
      optimisticFeed(queryClient, user?.id, (feed) => feed.map((n) => ({ ...n, viewed: true, shown: true }))),
    onError: (_error, _vars, context) => rollbackFeed(queryClient, user?.id, context),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["in_app_notifications"] });
    },
  });
}

/** Hides a notification from the user's feed without deleting audit history. */
export function useHideNotification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("notifications")
        .update({ hide_from_view: true })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onMutate: (id) => optimisticFeed(queryClient, user?.id, (feed) => feed.filter((n) => n.id !== id)),
    onError: (_error, _id, context) => rollbackFeed(queryClient, user?.id, context),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["in_app_notifications"] });
    },
  });
}
