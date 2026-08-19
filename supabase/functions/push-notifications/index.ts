import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getOrCreatePushConfig, createServiceClient, sendPushToRows } from '../_shared/push.ts';
import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';

type PushSubscriptionRow = {
  endpoint: string;
  subscription: Record<string, unknown> | null;
  kind?: 'web' | 'expo';
  expo_token?: string | null;
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

    // The VAPID public key is not a secret — it ships in every web client.
    if (action === 'public-key') {
      const config = await getOrCreatePushConfig(supabase);
      return jsonResponse({ publicKey: config.vapid_public_key });
    }

    // Every other action binds a device, or pushes, to an account. The identity
    // comes from the caller's JWT — never from the request body, which any
    // signed-in user could point at somebody else's account to receive their
    // alerts (coupon company names and balances travel in the payload).
    const user = await requireUser(req);
    const userId = user.id;
    const userEmail = user.email.toLowerCase();

    if (action === 'subscribe') {
      const subscription = body?.subscription;
      const endpoint = String(subscription?.endpoint || '');
      if (!endpoint) {
        return jsonResponse({ error: 'Missing subscription endpoint' }, 400);
      }

      const { error } = await supabase.from('push_subscriptions').upsert({
        endpoint,
        subscription,
        kind: 'web',
        expo_token: null,
        user_id: userId,
        user_email: userEmail,
        platform: body?.platform || null,
        user_agent: req.headers.get('user-agent'),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });
      if (error) throw new Error(`Subscribe failed: ${error.message}`);

      return jsonResponse({ status: 'subscribed' });
    }

    if (action === 'subscribe-expo') {
      const expoToken = String(body?.expo_token || '').trim();
      if (!expoToken) {
        return jsonResponse({ error: 'Missing expo_token' }, 400);
      }

      const { error } = await supabase.from('push_subscriptions').upsert({
        endpoint: `expo:${expoToken}`,
        subscription: null,
        kind: 'expo',
        expo_token: expoToken,
        user_id: userId,
        user_email: userEmail,
        platform: body?.platform || null,
        user_agent: req.headers.get('user-agent'),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });
      if (error) throw new Error(`Expo subscribe failed: ${error.message}`);

      return jsonResponse({ status: 'subscribed' });
    }

    // Unsubscribe is scoped to the caller so a known endpoint cannot be used to
    // silence somebody else's device.
    if (action === 'unsubscribe' || action === 'unsubscribe-expo') {
      const endpoint = action === 'unsubscribe-expo'
        ? `expo:${String(body?.expo_token || '').trim()}`
        : String(body?.endpoint || body?.subscription?.endpoint || '');
      if (endpoint === 'expo:' || !endpoint) {
        return jsonResponse({ error: 'Missing endpoint' }, 400);
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('user_id', userId);
      if (error) throw new Error(`Unsubscribe failed: ${error.message}`);

      return jsonResponse({ status: 'unsubscribed' });
    }

    if (action === 'test-user') {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('endpoint, subscription, kind, expo_token')
        .eq('user_id', userId);
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
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'UNAUTHENTICATED') return jsonResponse({ error: message }, 401);
    if (message === 'FORBIDDEN') return jsonResponse({ error: message }, 403);
    console.error('[push-notifications] fatal:', error);
    return jsonResponse({ error: message }, 500);
  }
});
