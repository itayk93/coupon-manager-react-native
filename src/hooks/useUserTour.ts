import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type TourStepKey = 'index' | 'add_coupon' | 'coupon_detail';

const STEP_COLUMN_MAP: Record<TourStepKey, 'index_timestamp' | 'add_coupon_timestamp' | 'coupon_detail_timestamp'> = {
  index: 'index_timestamp',
  add_coupon: 'add_coupon_timestamp',
  coupon_detail: 'coupon_detail_timestamp',
};

export function useUserTour() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const progressQuery = useQuery({
    queryKey: ['user_tour_progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_tour_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id),
  });

  const saveProgress = useMutation({
    mutationFn: async (step: TourStepKey) => {
      if (!user?.id) throw new Error('Not authenticated');
      const timestampColumn = STEP_COLUMN_MAP[step];
      const { error } = await supabase.from('user_tour_progress').upsert(
        {
          user_id: user.id,
          [timestampColumn]: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_tour_progress', user?.id] });
    },
  });

  const shouldShowTour = useMemo(() => {
    if (dismissed) return false;
    const progress = progressQuery.data;
    if (!progress) return true;
    return !progress.index_timestamp || !progress.add_coupon_timestamp || !progress.coupon_detail_timestamp;
  }, [dismissed, progressQuery.data]);

  const completedSteps = useMemo(() => {
    const progress = progressQuery.data;
    return {
      index: Boolean(progress?.index_timestamp),
      add_coupon: Boolean(progress?.add_coupon_timestamp),
      coupon_detail: Boolean(progress?.coupon_detail_timestamp),
    };
  }, [progressQuery.data]);

  return {
    progress: progressQuery.data,
    isLoading: progressQuery.isLoading,
    shouldShowTour,
    completedSteps,
    dismissTour: () => setDismissed(true),
    markStepCompleted: saveProgress.mutateAsync,
    isSaving: saveProgress.isPending,
  };
}
