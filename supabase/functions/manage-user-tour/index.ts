import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { requireSameUser, requireUser } from '../_shared/auth.ts';

type TourStepKey = 'index' | 'add_coupon' | 'coupon_detail';

const STEP_COLUMN_MAP: Record<TourStepKey, 'index_timestamp' | 'add_coupon_timestamp' | 'coupon_detail_timestamp'> = {
  index: 'index_timestamp',
  add_coupon: 'add_coupon_timestamp',
  coupon_detail: 'coupon_detail_timestamp',
};

function supa() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) });

  try {
    const { action, user_id, step } = await req.json();
    const authenticatedUser = await requireUser(req);
    requireSameUser(user_id, authenticatedUser.id);
    const userId = authenticatedUser.id;

    if (!Number.isFinite(userId) || userId <= 0) {
      return jsonResponse({ error: 'user_id חסר או לא תקין' }, 400);
    }

    const supabase = supa();

    if (action === 'get') {
      const { data, error } = await supabase
        .from('user_tour_progress')
        .select('user_id,index_timestamp,add_coupon_timestamp,coupon_detail_timestamp,id')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return jsonResponse({ progress: data ?? null });
    }

    if (action === 'mark_step') {
      if (!step || !(step in STEP_COLUMN_MAP)) {
        return jsonResponse({ error: 'step חסר או לא תקין' }, 400);
      }

      const timestampColumn = STEP_COLUMN_MAP[step as TourStepKey];
      const { error } = await supabase
        .from('user_tour_progress')
        .upsert(
          {
            user_id: userId,
            [timestampColumn]: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'action לא נתמך' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return jsonResponse({ error: status === 500 ? 'אירעה שגיאה' : status === 401 ? 'נדרשת התחברות' : 'אין הרשאה' }, status);
  }
});
