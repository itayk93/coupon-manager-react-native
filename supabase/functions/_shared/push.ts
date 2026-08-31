import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { safeFetch } from '../_shared/ssrf.ts';

const DEFAULT_SUBJECT = 'mailto:push@couponmaster.app';
const DEFAULT_PAYLOAD = {
  title: 'קופון מאסטר',
  body: 'יש עדכון חדש במערכת.',
  dir: 'rtl',
  url: '/notifications',
  icon: '/pwa-192x192.png',
  badge: '/pwa-192x192.png',
  tag: 'coupon-master-update',
  requireInteraction: false,
  renotify: false,
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type PushConfigRow = {
  id: number;
  vapid_public_key: string;
  vapid_private_key: string;
  vapid_subject: string;
};

export type PushSubscriptionRow = {
  endpoint: string;
  subscription: Record<string, unknown> | null;
  kind?: 'web' | 'expo';
  expo_token?: string | null;
};

export type PushSendStats = {
  total: number;
  sent: number;
  failed: number;
  removed: number;
};

export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

export async function getOrCreatePushConfig(
  supabase: ReturnType<typeof createServiceClient>
): Promise<PushConfigRow> {
  const { data, error } = await supabase
    .from('push_system_config')
    .select('id, vapid_public_key, vapid_private_key, vapid_subject')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load push config: ${error.message}`);
  if (data?.vapid_public_key && data?.vapid_private_key) {
    return data as PushConfigRow;
  }

  const generated = webpush.generateVAPIDKeys();
  const row: PushConfigRow = {
    id: 1,
    vapid_public_key: generated.publicKey,
    vapid_private_key: generated.privateKey,
    vapid_subject: DEFAULT_SUBJECT,
  };

  const { error: upsertError } = await supabase
    .from('push_system_config')
    .upsert(row, { onConflict: 'id' });
  if (upsertError) {
    throw new Error(`Failed to initialize push config: ${upsertError.message}`);
  }

  return row;
}

async function sendWebPush(
  supabase: ReturnType<typeof createServiceClient>,
  rows: PushSubscriptionRow[],
  payload: Record<string, unknown>
): Promise<PushSendStats> {
  if (rows.length === 0) {
    return { total: 0, sent: 0, failed: 0, removed: 0 };
  }

  const config = await getOrCreatePushConfig(supabase);
  webpush.setVapidDetails(
    config.vapid_subject || DEFAULT_SUBJECT,
    config.vapid_public_key,
    config.vapid_private_key
  );

  const serializedPayload = JSON.stringify({
    ...DEFAULT_PAYLOAD,
    ...payload,
    sentAt: new Date().toISOString(),
  });

  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  for (const row of rows) {
    if (!row.subscription) {
      failed += 1;
      continue;
    }
    try {
      await webpush.sendNotification(row.subscription as any, serializedPayload, { TTL: 300 });
      sent += 1;
    } catch (error: any) {
      failed += 1;
      const code = error?.statusCode;
      if (code === 404 || code === 410) {
        staleEndpoints.push(row.endpoint);
      } else {
        console.error('[push] web send error:', code, error?.message || String(error));
      }
    }
  }

  if (staleEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
  }

  return { total: rows.length, sent, failed, removed: staleEndpoints.length };
}

async function sendExpoPush(
  supabase: ReturnType<typeof createServiceClient>,
  rows: PushSubscriptionRow[],
  payload: Record<string, unknown>
): Promise<PushSendStats> {
  const tokens = rows
    .map((row) => row.expo_token)
    .filter((token): token is string => Boolean(token && token.trim()));

  if (tokens.length === 0) {
    return { total: rows.length, sent: 0, failed: rows.length, removed: 0 };
  }

  try {
    const title = String(payload.title || DEFAULT_PAYLOAD.title);
    const body = String(payload.body || DEFAULT_PAYLOAD.body);
    const url = String(payload.url || DEFAULT_PAYLOAD.url);

    const messages = tokens.map((to) => ({
      to,
      title,
      body,
      data: { url },
      sound: 'default',
      priority: 'high',
    }));

    const resp = await safeFetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error('[push] expo send error:', resp.status, text);
      return { total: tokens.length, sent: 0, failed: tokens.length, removed: 0 };
    }

    const data = await resp.json();
    const tickets: Array<{ status?: string; details?: { error?: string } }> =
      data?.data || [];

    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    tickets.forEach((ticket, index) => {
      if (ticket?.status === 'ok') {
        sent += 1;
        return;
      }
      failed += 1;
      const reason = ticket?.details?.error;
      console.error('[push] expo ticket error:', reason);
      // Uninstalled app or a token Expo has retired. Web push prunes these on
      // 404/410; do the same here so the table does not fill with dead rows.
      if (reason === 'DeviceNotRegistered' && tokens[index]) {
        staleEndpoints.push(`expo:${tokens[index]}`);
      }
    });

    if (staleEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
    }

    return { total: tokens.length, sent, failed, removed: staleEndpoints.length };
  } catch (error) {
    console.error('[push] expo dispatch failed:', error);
    return { total: tokens.length, sent: 0, failed: tokens.length, removed: 0 };
  }
}

/**
 * Dispatch a single payload to both Web Push and Expo tokens. Web rows require
 * `subscription`; Expo rows require `expo_token`. Stale web endpoints are
 * removed from the table as a side effect. A channel-level failure never
 * rejects the whole dispatch — it is reported in the stats instead.
 */
export async function sendPushToRows(
  supabase: ReturnType<typeof createServiceClient>,
  rows: PushSubscriptionRow[],
  payload: Record<string, unknown>
): Promise<PushSendStats> {
  if (rows.length === 0) {
    return { total: 0, sent: 0, failed: 0, removed: 0 };
  }

  const webRows = rows.filter((row) => row.kind !== 'expo');
  const expoRows = rows.filter((row) => row.kind === 'expo');

  const [webStats, expoStats] = await Promise.all([
    sendWebPush(supabase, webRows, payload),
    sendExpoPush(supabase, expoRows, payload),
  ]);

  return {
    total: rows.length,
    sent: webStats.sent + expoStats.sent,
    failed: webStats.failed + expoStats.failed,
    removed: webStats.removed + expoStats.removed,
  };
}

/**
 * Convenience helper for a whole user: loads every subscription for the user
 * (both kinds) and sends the payload through the right channel.
 */
export async function sendPushToUser(
  supabase: ReturnType<typeof createServiceClient>,
  userId: number,
  payload: Record<string, unknown>
): Promise<PushSendStats> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, subscription, kind, expo_token')
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to load push subscriptions: ${error.message}`);

  return sendPushToRows(supabase, (data || []) as PushSubscriptionRow[], payload);
}
