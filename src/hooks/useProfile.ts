import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { USER_COLUMNS } from "@/lib/userColumns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { User as UserRow } from "@/integrations/supabase";
import { notify } from "@/lib/notify";

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.email) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("users")
        .select(USER_COLUMNS)
        .eq("email", user.email)
        .single();

      if (error) {
        throw error;
      }

      return data as UserRow;
    },
    enabled: !!user?.email,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<UserRow>) => {
      if (!user?.email) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("email", user.email)
        .select(USER_COLUMNS)
        .single();

      if (error) throw error;
      return data;
    },
    // The profile shows the change at once; a failure restores it.
    onMutate: async (updates) => {
      const key = ["profile", user?.id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<UserRow>(key);
      if (previous) queryClient.setQueryData<UserRow>(key, { ...previous, ...updates });
      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["profile", user?.id], data);
      refreshUser?.();
    },
    onError: (error: any, _updates, context) => {
      if (context?.previous) queryClient.setQueryData(["profile", user?.id], context.previous);
      notify.error("שגיאה בעדכון הפרופיל", error.message);
    },
  });
}
