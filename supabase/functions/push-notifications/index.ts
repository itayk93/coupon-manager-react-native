import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getOrCreatePushConfig, createServiceClient, sendPushToRows } from '../_shared/push.ts';
import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';

type PushSubscriptionRow = {
  endpoint: string;
  subscription: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabase = createServiceClient();
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (!action) return jsonResponse({ error: 'Missing action' }, 400);

    if (action === 'public-key') {
      const config = await getOrCreatePushConfig(supabase);
      return jsonResponse({ publicKey: config.vapid_public_key });
    }

    if (action === 'subscribe') {
      const subscription = body?.subscription;
      const endpoint = String(subscription?.endpoint || '');
      const userId = Number(body?.user_id || 0);
      const userEmail = String(body?.user_email || '').trim().toLowerCase();
      if (!endpoint || !userId || !userEmail) {
        return jsonResponse({ error: 'Missing subscription identity' }, 400);
      }

      const payload = {
        endpoint,
        subscription,
        user_id: userId,
        user_email: userEmail,
        platform: body?.platform || null,
        user_agent: req.headers.get('user-agent'),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('push_subscriptions').upsert(payload, {
        onConflict: 'endpoint',
      });
      if (error) throw new Error(`Subscribe failed: ${error.message}`);

      return jsonResponse({ status: 'subscribed' });
    }

    if (action === 'unsubscribe') {
      const endpoint = String(body?.endpoint || body?.subscription?.endpoint || '');
      if (!endpoint) return jsonResponse({ error: 'Missing endpoint' }, 400);

      const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      if (error) throw new Error(`Unsubscribe failed: ${error.message}`);

      return jsonResponse({ status: 'unsubscribed' });
    }

    if (action === 'test-user') {
      const userId = Number(body?.user_id || 0);
      const userEmail = String(body?.user_email || '').trim().toLowerCase();
      if (!userId || !userEmail) return jsonResponse({ error: 'Missing user identity' }, 400);

      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('endpoint, subscription')
        .eq('user_id', userId)
        .eq('user_email', userEmail);
      if (error) throw new Error(`Failed to load subscriptions: ${error.message}`);

      const stats = await sendPushToRows(
        supabase,
        (data || []) as PushSubscriptionRow[],
        body?.payload || {}
      );
      return jsonResponse({ status: 'sent', stats });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error('[push-notifications] fatal:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
