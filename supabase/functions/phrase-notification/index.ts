// Supabase Edge Function: phrase-notification
//
// Wording, on request, for a notification the *device* will raise later.
//
// The "you are near a shop where you have a coupon" alert is produced by the
// phone itself, from a geofence, with no server in the loop — that is what
// makes it instant, free, and possible with the app closed. But it still has to
// sound like the rest of the app rather than like a string constant.
//
// So the phrasing is fetched ahead of time, while the app is open and online,
// and stored with the geofence. When someone walks past the shop the sentence
// is already on the device. The model never runs at the moment it matters, and
// the API key never leaves the server.

import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/push.ts';
import { phrase } from '../_shared/notificationVoice.ts';
import { NOTIFICATION_TYPES, type NotificationTypeId } from '../_shared/notificationTypes.ts';

/** Enough for the alert to feel different each time without costing much. */
const MAX_VARIANTS = 3;

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const caller = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const type = body?.type as NotificationTypeId;
    const payload = (body?.payload ?? {}) as Record<string, unknown>;
    const count = Math.min(Math.max(Number(body?.count) || 1, 1), MAX_VARIANTS);

    if (!type || !(type in NOTIFICATION_TYPES)) {
      return jsonResponse({ error: 'unknown type' }, 400);
    }

    const supabase = createServiceClient();

    // Sequential rather than parallel: three variants of one short sentence is
    // not worth three concurrent calls, and the model is likelier to repeat
    // itself when it cannot see how long each one took.
    const variants: Array<{ title: string; body: string }> = [];
    for (let index = 0; index < count; index += 1) {
      const copy = await phrase(type, payload, { supabase, userId: caller.id });
      // Identical output means the model fell back; a second try would fall
      // back the same way.
      if (variants.some((item) => item.body === copy.body)) break;
      variants.push({ title: copy.title, body: copy.body });
    }

    return jsonResponse({ type, variants });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return jsonResponse({ error: message }, 401);
    if (message === 'FORBIDDEN') return jsonResponse({ error: message }, 403);
    console.error('[phrase-notification] fatal:', err);
    return jsonResponse({ error: 'internal error' }, 500);
  }
});
