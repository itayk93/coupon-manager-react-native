import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { publicUserId } from '@/lib/userId';

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
  const [localProgress, setLocalProgress] = useState<Partial<Record<TourStepKey, boolean>>>({});

  const progressQuery = useQuery({
    queryKey: ['user_tour_progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.functions.invoke('manage-user-tour', {
        body: {
          action: 'get',
          user_id: publicUserId(user),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.progress ?? null;
    },
    enabled: Boolean(user?.id),
  });

  const saveProgress = useMutation({
    mutationFn: async (step: TourStepKey) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('manage-user-tour', {
        body: {
          action: 'mark_step',
          user_id: publicUserId(user),
          step,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return step;
    },
    onMutate: async (step) => {
      setLocalProgress((current) => ({ ...current, [step]: true }));
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
      index: Boolean(localProgress.index || progress?.index_timestamp),
      add_coupon: Boolean(localProgress.add_coupon || progress?.add_coupon_timestamp),
      coupon_detail: Boolean(localProgress.coupon_detail || progress?.coupon_detail_timestamp),
    };
  }, [localProgress, progressQuery.data]);

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
