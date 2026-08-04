import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { USER_COLUMNS } from '@/lib/userColumns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { User as UserRow } from '@/integrations/supabase';
import { toast } from 'sonner';

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.email) throw new Error("Not authenticated");

      // The original user table links primarily by email or we need to find the user row.
      // Since supabase auth uses UUID and our public.users uses Integer ID,
      // we match by email which is marked unique in the original models.
      const { data, error } = await supabase
        .from('users')
        .select(USER_COLUMNS)
        .eq('email', user.email)
        .single();

      if (error) {
        // If the user doesn't exist in public.users yet (e.g. just signed up via OAuth),
        // we might need to handle creation via an Edge Function or trigger, but for now we throw.
        throw error;
      }

      return data as UserRow;
    },
    enabled: !!user?.email,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<UserRow>) => {
      if (!user?.email) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('email', user.email)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('הפרופיל עודכן בהצלחה!');
      queryClient.setQueryData(['profile', user?.id], data);
    },
    onError: (error: any) => {
      toast.error(`שגיאה בעדכון הפרופיל: ${error.message}`);
    }
  });
}
