import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Coupon, CouponInsert, CouponUpdate } from '@/integrations/supabase';
import { decrypt, encrypt } from '@/lib/encryption';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type DecryptedCoupon = Omit<Coupon, 'code' | 'description' | 'buyme_coupon_url' | 'strauss_coupon_url' | 'xgiftcard_coupon_url' | 'xtra_coupon_url' | 'cvv' | 'card_exp'> & {
  code: string;
  description: string | null;
  buyme_coupon_url: string | null;
  strauss_coupon_url: string | null;
  xgiftcard_coupon_url: string | null;
  xtra_coupon_url: string | null;
  cvv: string | null;
  card_exp: string | null;
};

// Helper function to decrypt a single coupon
const decryptCoupon = async (coupon: Coupon): Promise<DecryptedCoupon> => {
  return {
    ...coupon,
    code: await decrypt(coupon.code),
    description: coupon.description ? await decrypt(coupon.description) : null,
    buyme_coupon_url: coupon.buyme_coupon_url ? await decrypt(coupon.buyme_coupon_url) : null,
    strauss_coupon_url: coupon.strauss_coupon_url ? await decrypt(coupon.strauss_coupon_url) : null,
    xgiftcard_coupon_url: coupon.xgiftcard_coupon_url ? await decrypt(coupon.xgiftcard_coupon_url) : null,
    xtra_coupon_url: coupon.xtra_coupon_url ? await decrypt(coupon.xtra_coupon_url) : null,
    cvv: coupon.cvv ? await decrypt(coupon.cvv) : null,
    card_exp: coupon.card_exp ? await decrypt(coupon.card_exp) : null,
  };
};

export function useCoupons() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['coupons', user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('coupon')
        .select('*')
        .eq('user_id', user.id)
        .order('date_added', { ascending: false });

      if (error) {
        throw error;
      }

      // Decrypt all coupons
      const decryptedCoupons = await Promise.all((data || []).map(decryptCoupon));
      return decryptedCoupons;
    },
    enabled: !!user,
  });
}

export function useCoupon(couponId: number | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['coupon', couponId],
    queryFn: async () => {
      if (!user || !couponId) throw new Error("Invalid request");

      const { data, error } = await supabase
        .from('coupon')
        .select('*')
        .eq('id', couponId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        throw error;
      }

      return await decryptCoupon(data);
    },
    enabled: !!user && !!couponId,
  });
}

export function useAddCoupon() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (newCoupon: Partial<DecryptedCoupon>) => {
      if (!user) throw new Error("Not authenticated");

      // Encrypt sensitive fields using Fernet encryption (matching legacy Python EncryptedString)
      const code = newCoupon.code ? await encrypt(newCoupon.code) : '';
      const description = newCoupon.description ? await encrypt(newCoupon.description) : null;
      const cvv = newCoupon.cvv ? await encrypt(newCoupon.cvv) : null;
      const card_exp = newCoupon.card_exp ? await encrypt(newCoupon.card_exp) : null;
      const buyme_coupon_url = newCoupon.buyme_coupon_url ? await encrypt(newCoupon.buyme_coupon_url) : null;

      // Ensure expiration format is YYYY-MM-DD (max 10 chars for VARCHAR(10) column)
      const expiration = newCoupon.expiration
        ? (newCoupon.expiration.includes('T') ? newCoupon.expiration.split('T')[0] : newCoupon.expiration).slice(0, 10)
        : null;

      const couponToInsert: CouponInsert = {
        ...newCoupon as any, // Type casting to bypass strict type checking temporarily
        user_id: user.id,
        code,
        description,
        cvv,
        card_exp,
        buyme_coupon_url,
        expiration,
        date_added: new Date().toISOString(),
        used_value: newCoupon.used_value || 0,
        status: newCoupon.status || 'פעיל',
      };

      const { data, error } = await supabase
        .from('coupon')
        .insert(couponToInsert)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('הקופון נוסף בהצלחה!');
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: (error: any) => {
      toast.error(`שגיאה בהוספת הקופון: ${error.message}`);
    }
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number, updates: Partial<DecryptedCoupon> }) => {
      if (!user) throw new Error("Not authenticated");

      // Encrypt sensitive fields if they were updated
      const encryptedUpdates: any = { ...updates };
      
      if (updates.code !== undefined) {
        encryptedUpdates.code = updates.code ? await encrypt(updates.code) : '';
      }
      if (updates.description !== undefined) {
        encryptedUpdates.description = updates.description ? await encrypt(updates.description) : null;
      }
      if (updates.cvv !== undefined) {
        encryptedUpdates.cvv = updates.cvv ? await encrypt(updates.cvv) : null;
      }
      if (updates.card_exp !== undefined) {
        encryptedUpdates.card_exp = updates.card_exp ? await encrypt(updates.card_exp) : null;
      }
      if (updates.buyme_coupon_url !== undefined) {
        encryptedUpdates.buyme_coupon_url = updates.buyme_coupon_url ? await encrypt(updates.buyme_coupon_url) : null;
      }
      if (updates.expiration !== undefined) {
        encryptedUpdates.expiration = updates.expiration
          ? (updates.expiration.includes('T') ? updates.expiration.split('T')[0] : updates.expiration).slice(0, 10)
          : null;
      }

      const { data, error } = await supabase
        .from('coupon')
        .update(encryptedUpdates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('הקופון עודכן בהצלחה!');
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      queryClient.invalidateQueries({ queryKey: ['coupon', data.id] });
    },
    onError: (error: any) => {
      toast.error(`שגיאה בעדכון הקופון: ${error.message}`);
    }
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: number) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('coupon')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success('הקופון נמחק בהצלחה!');
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: (error: any) => {
      toast.error(`שגיאה במחיקת הקופון: ${error.message}`);
    }
  });
}
