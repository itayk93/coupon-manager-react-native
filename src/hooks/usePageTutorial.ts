import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { publicUserId } from "@/lib/userId";

export type PageTutorialKey = "coupon_import";

type TutorialProgress = Record<string, string>;

export function usePageTutorial(tutorialKey: PageTutorialKey) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["page_tutorial", user?.id, tutorialKey] as const;

  const progress = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.functions.invoke("manage-user-tour", {
        body: {
          action: "get_tutorial",
          user_id: publicUserId(user),
          tutorial_key: tutorialKey,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const tutorials = (data?.tutorials ?? {}) as TutorialProgress;
      return Boolean(tutorials[tutorialKey]);
    },
    enabled: Boolean(user?.id),
  });

  const markSeen = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase.functions.invoke("manage-user-tour", {
        body: {
          action: "mark_tutorial",
          user_id: publicUserId(user),
          tutorial_key: tutorialKey,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onMutate: () => {
      queryClient.setQueryData(queryKey, true);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    hasSeen: progress.data ?? false,
    isLoading: progress.isLoading,
    isReady: progress.isSuccess,
    markSeen: markSeen.mutateAsync,
  };
}
