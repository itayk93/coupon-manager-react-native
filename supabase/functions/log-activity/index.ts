// Supabase Edge Function: log-activity
//
// Records what a user did into public.user_activities — the same table the old
// web app has been filling since 2024, so the history stays in one place.
//
// The client sends batches of events. It does not send who it is: the account
// comes from the JWT, and the IP and device come from the request. That is the
// whole reason this function exists rather than an insert from the app — an
// analytics row that the client can author is a row that says whatever the
// client wants, and the geo columns cannot be filled from a phone at all.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected automatically)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import {
  isActivityAction,
  MAX_EVENTS_PER_REQUEST,
  sanitizeCouponId,
  sanitizeMetadata,
} from '../_shared/activityEvents.ts';

/** Older than this and the clock on the device is not to be trusted. */
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;

type IncomingEvent = {
  action?: unknown;
  coupon_id?: unknown;
  occurred_at?: unknown;
  metadata?: unknown;
};

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  // The left-most entry is the original client; the rest are proxies.
  const first = forwarded?.split(',')[0]?.trim();
  return first || req.headers.get('cf-connecting-ip') || null;
}

/**
 * Device and app version, as the client states them in its user agent. Kept as
 * free text like the legacy rows rather than parsed into a taxonomy that would
 * be wrong within a release. user_activities.device is varchar(50), so a long
 * browser user agent has to be cut to fit or the whole batch fails to insert.
 */
const DEVICE_MAX_LENGTH = 50;

function clientDevice(req: Request): string | null {
  const ua = req.headers.get('user-agent');
  return ua ? ua.slice(0, DEVICE_MAX_LENGTH) : null;
}

/**
 * A device clock can be anything. An event stamped in the future, or older
 * than a day, is pinned to now so one wrong phone cannot scatter rows across
 * the timeline.
 */
function eventTimestamp(value: unknown): string {
  const now = Date.now();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed <= now && now - parsed <= MAX_EVENT_AGE_MS) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date(now).toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) });

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

    const user = await requireUser(req);
    const body = await req.json().catch(() => null);
    const incoming = Array.isArray(body?.events) ? (body.events as IncomingEvent[]) : null;
    if (!incoming) return jsonResponse({ error: 'events must be an array' }, 400);
    if (incoming.length > MAX_EVENTS_PER_REQUEST) {
      return jsonResponse({ error: `at most ${MAX_EVENTS_PER_REQUEST} events per request` }, 400);
    }

    const ip = clientIp(req);
    const device = clientDevice(req);
    // Supabase sits behind a proxy that resolves the country for us; anything
    // finer would mean an outbound geo-IP call per event.
    const country = req.headers.get('cf-ipcountry');

    const rows = incoming
      // An unknown action is dropped rather than stored: the vocabulary is
      // shared with the client, so an unknown one is a bug or a forgery.
      .filter((event) => isActivityAction(event.action))
      .map((event) => ({
        user_id: user.id,
        action: event.action as string,
        coupon_id: sanitizeCouponId(event.coupon_id),
        timestamp: eventTimestamp(event.occurred_at),
        ip_address: ip,
        device,
        country_code: country && country !== 'XX' ? country : null,
        extra_metadata: sanitizeMetadata(event.metadata),
      }));

    if (!rows.length) return jsonResponse({ recorded: 0, rejected: incoming.length });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { error } = await supabase.from('user_activities').insert(rows);
    if (error) {
      console.error('[log-activity] insert failed:', error.message);
      return jsonResponse({ error: 'INTERNAL_ERROR' }, 500);
    }

    return jsonResponse({ recorded: rows.length, rejected: incoming.length - rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return jsonResponse({ error: message }, 401);
    if (message === 'FORBIDDEN') return jsonResponse({ error: message }, 403);
    console.error('[log-activity] fatal:', err);
    return jsonResponse({ error: 'INTERNAL_ERROR' }, 500);
  }
});
