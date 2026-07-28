import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const DEFAULT_SUBJECT = 'mailto:push@couponmaster.app';
const DEFAULT_PAYLOAD = {
  title: 'קופון מאסטר',
  body: 'יש עדכון חדש במערכת.',
  url: '/notifications',
  icon: '/pwa-192x192.png',
  badge: '/pwa-192x192.png',
  tag: 'coupon-master-update',
  requireInteraction: false,
  renotify: false,
};

type PushConfigRow = {
  id: number;
  vapid_public_key: string;
  vapid_private_key: string;
  vapid_subject: string;
};

type PushSubscriptionRow = {
  endpoint: string;
  subscription: Record<string, unknown>;
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

export async function sendPushToRows(
  supabase: ReturnType<typeof createServiceClient>,
  rows: PushSubscriptionRow[],
  payload: Record<string, unknown>
) {
  const config = await getOrCreatePushConfig(supabase);
  webpush.setVapidDetails(
    config.vapid_subject || DEFAULT_SUBJECT,
    config.vapid_public_key,
    config.vapid_private_key
  );

  if (rows.length === 0) {
    return { total: 0, sent: 0, failed: 0, removed: 0 };
  }

  const serializedPayload = JSON.stringify({
    ...DEFAULT_PAYLOAD,
    ...payload,
    sentAt: new Date().toISOString(),
  });

  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription as any, serializedPayload, { TTL: 300 });
      sent += 1;
    } catch (error: any) {
      failed += 1;
      const code = error?.statusCode;
      if (code === 404 || code === 410) {
        staleEndpoints.push(row.endpoint);
      } else {
        console.error('[push] send error:', code, error?.message || String(error));
      }
    }
  }

  if (staleEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
  }

  return {
    total: rows.length,
    sent,
    failed,
    removed: staleEndpoints.length,
  };
}
