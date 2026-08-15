import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Generate a stable-per-tab session id
function getSessionId(): string {
  const KEY = 'cm_viewer_session';
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.floor(performance.now() * 1000).toString(36)}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

export type ActiveViewer = {
  user_id: number;
  first_name?: string;
  last_name?: string;
  session_id: string;
};

// Tracks the current user as an active viewer of a coupon and reports other live viewers.
// Uses the coupon_active_viewers table + Supabase Realtime + a heartbeat.
export function useActiveViewers(couponId: number | undefined) {
  const { user } = useAuth();
  const [viewers, setViewers] = useState<ActiveViewer[]>([]);
  const sessionId = getSessionId();

  useEffect(() => {
    if (!couponId || !user) return;
    let cancelled = false;

    const STALE_MS = 30_000;

    const upsertHeartbeat = async () => {
      await supabase.from('coupon_active_viewers').upsert(
        {
          coupon_id: couponId,
          user_id: user.id,
          session_id: sessionId,
          last_activity: new Date().toISOString(),
        },
        { onConflict: 'coupon_id,user_id,session_id' }
      );
    };

    const refresh = async () => {
      const cutoff = new Date(Date.now() - STALE_MS).toISOString();
      const { data } = await supabase
        .from('coupon_active_viewers')
        .select('user_id, session_id, users:user_id (first_name, last_name)')
        .eq('coupon_id', couponId)
        .gte('last_activity', cutoff);

      if (cancelled || !data) return;
      const unique: Record<string, ActiveViewer> = {};
      for (const row of data as any[]) {
        unique[row.session_id] = {
          user_id: row.user_id,
          first_name: row.users?.first_name,
          last_name: row.users?.last_name,
          session_id: row.session_id,
        };
      }
      setViewers(Object.values(unique));
    };

    const cleanup = async () => {
      await supabase
        .from('coupon_active_viewers')
        .delete()
        .eq('coupon_id', couponId)
        .eq('user_id', user.id)
        .eq('session_id', sessionId);
    };

    upsertHeartbeat().then(refresh);
    const heartbeat = setInterval(() => upsertHeartbeat().then(refresh), 15_000);

    const channel = supabase
      .channel(`viewers:${couponId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coupon_active_viewers', filter: `coupon_id=eq.${couponId}` },
        () => refresh()
      )
      .subscribe();

    const onUnload = () => { cleanup(); };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', onUnload);
      supabase.removeChannel(channel);
      cleanup();
    };
  }, [couponId, user, sessionId]);

  // Other viewers = everyone except the current session
  const otherViewers = viewers.filter((v) => v.session_id !== sessionId);
  return { viewers, otherViewers };
}
