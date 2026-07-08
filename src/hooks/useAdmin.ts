import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useAdminStats() {
  const { user, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['admin_stats'],
    queryFn: async () => {
      if (!user || !isAdmin) throw new Error("Not authorized");

      // Get user count
      const { count: userCount, error: userError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
        
      if (userError) throw userError;

      // Get total coupons count
      const { count: couponCount, error: couponError } = await supabase
        .from('coupon')
        .select('*', { count: 'exact', head: true });
        
      if (couponError) throw couponError;

      // Get active users (e.g., users who logged in or updated within last 30 days)
      // Since we don't have a reliable last_login in public.users, we just estimate or skip.
      
      return {
        totalUsers: userCount || 0,
        totalCoupons: couponCount || 0,
      };
    },
    enabled: !!user && isAdmin,
  });
}

export function useAdminUsers() {
  const { user, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      if (!user || !isAdmin) throw new Error("Not authorized");

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // Get latest 50 users for the dashboard
        
      if (error) throw error;
      
      return data;
    },
    enabled: !!user && isAdmin,
  });
}

export function useAdminSettings() {
  const { user, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['admin_settings'],
    queryFn: async () => {
      if (!user || !isAdmin) throw new Error("Not authorized");

      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .order('setting_key');
        
      if (error) throw error;
      
      return data;
    },
    enabled: !!user && isAdmin,
  });
}

export function useUpdateAdminSetting() {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();

  return useMutation({
    mutationFn: async ({ id, value }: { id: number, value: string }) => {
      if (!user || !isAdmin) throw new Error("Not authorized");

      const { error } = await supabase
        .from('admin_settings')
        .update({ setting_value: value, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success('ההגדרה עודכנה בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['admin_settings'] });
    },
    onError: (error: any) => {
      toast.error(`שגיאה בעדכון ההגדרה: ${error.message}`);
    }
  });
}
