import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CouponShare, CouponInsert } from '@/integrations/supabase';
import { toast } from 'sonner';
import { decrypt, encrypt } from '@/lib/encryption';

// Custom type to include the joined coupon data and the sharer data
export type PopulatedShare = CouponShare & {
  coupon: {
    id: number;
    company: string;
    description: string | null;
    value: number;
    used_value: number;
    code: string; // will be decrypted
    expiration: string | null;
  };
  shared_by: {
    email: string;
    first_name: string;
    last_name: string;
  };
};

export function useSharedWithMe() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['shared_with_me', user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // The original schema links users by ID. We need the user's integer ID from the public.users table.
      // We will first get the public user ID.
      const { data: publicUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email || '')
        .single();

      if (!publicUser) return [];

      const { data, error } = await supabase
        .from('coupon_shares')
        .select(`
          *,
          coupon:coupon_id (id, company, description, value, used_value, code, expiration),
          shared_by:shared_by_user_id (email, first_name, last_name)
        `)
        .eq('shared_with_user_id', publicUser.id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Decrypt the coupon code for each share
      const decryptedData = await Promise.all((data as any[]).map(async (share) => {
        return {
          ...share,
          coupon: {
            ...share.coupon,
            code: await decrypt(share.coupon.code),
            description: share.coupon.description ? await decrypt(share.coupon.description) : null
          }
        };
      }));

      return decryptedData as PopulatedShare[];
    },
    enabled: !!user,
  });
}

export function useMyShares() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my_shares', user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data: publicUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email || '')
        .single();

      if (!publicUser) return [];

      const { data, error } = await supabase
        .from('coupon_shares')
        .select(`
          *,
          coupon:coupon_id (id, company, description, value, used_value, expiration),
          shared_with:shared_with_user_id (email, first_name, last_name)
        `)
        .eq('shared_by_user_id', publicUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Decrypt descriptions if any
      const decryptedData = await Promise.all((data as any[]).map(async (share) => {
        return {
          ...share,
          coupon: {
            ...share.coupon,
            description: share.coupon.description ? await decrypt(share.coupon.description) : null
          }
        };
      }));

      return decryptedData;
    },
    enabled: !!user,
  });
}

export function useRevokeShare() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (shareId: number) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('coupon_shares')
        .update({ 
          status: 'revoked', 
          revoked_at: new Date().toISOString() 
        })
        .eq('id', shareId);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success('השיתוף בוטל בהצלחה!');
      queryClient.invalidateQueries({ queryKey: ['my_shares'] });
    },
    onError: (error: any) => {
      toast.error(`שגיאה בביטול השיתוף: ${error.message}`);
    }
  });
}
