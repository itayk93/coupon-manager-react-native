// Preference centre behind the unsubscribe link in every email.
//
// Reachable without a session — the signed token in the link is the
// authentication, because the link is clicked straight from an inbox.
//
// Three ways in:
//   GET  ?token=...                     read current state, to render the page
//   POST {token, scope, opted_out}      apply one choice
//   POST ?token=... (List-Unsubscribe)  RFC 8058 one-click, from the mail client
//
// `scope` separates the two kinds of mail so a user can stop expiry reminders
// without also losing product news, or the reverse. One-click has no UI to ask
// in, so per RFC 8058 it takes the safest reading and stops everything.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';

/** 'expiry' = coupon reminders, 'marketing' = newsletters, 'all' = both. */
type Scope = 'expiry' | 'marketing' | 'all';

function isScope(value: unknown): value is Scope {
  return value === 'expiry' || value === 'marketing' || value === 'all';
}

const textEncoder = new TextEncoder();

function supa() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function signPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

async function verifyToken(token: string, secret: string) {
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) return null;

  // A hand-edited link is a bad request, not a server fault, so malformed
  // base64 and malformed JSON both have to fail as "invalid token" here rather
  // than throwing out to the 500 handler.
  try {
    return await parseToken(payloadPart, signaturePart, secret);
  } catch {
    return null;
  }
}

async function parseToken(payloadPart: string, signaturePart: string, secret: string) {
  const payloadBytes = fromBase64Url(payloadPart);
  const payload = new TextDecoder().decode(payloadBytes);
  const expectedSignature = await signPayload(payload, secret);
  if (!timingSafeEqual(expectedSignature, signaturePart)) return null;

  const parsed = JSON.parse(payload) as {
    user_public_id?: string;
    user_id?: number;
    email?: string;
    type?: string;
  };
  const hasIdentity = /^usr_[0-9a-f]{20}$/.test(parsed.user_public_id || '')
    || (Number.isSafeInteger(parsed.user_id) && Number(parsed.user_id) > 0);
  if (!hasIdentity || !parsed.email || parsed.type !== 'unsubscribe') return null;
  return parsed;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...corsHeadersFor(req), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
    });
  }

  try {
    const secret = Deno.env.get('UNSUBSCRIBE_SECRET');
    if (!secret) return jsonResponse({ error: 'UNSUBSCRIBE_SECRET not configured' }, 500);

    const url = new URL(req.url);
    const contentType = req.headers.get('content-type') || '';

    // A mail client's one-click POST carries the token in the query string and
    // `List-Unsubscribe=One-Click` in a form body — never JSON.
    const isOneClick = req.method === 'POST' && !contentType.includes('application/json');

    let token = url.searchParams.get('token');
    let scope: Scope = 'all';
    let optedOut = true;

    if (req.method === 'POST' && !isOneClick) {
      const body = await req.json().catch(() => ({}));
      token = body.token || token;
      if (isScope(body.scope)) scope = body.scope;
      optedOut = body.opted_out === undefined ? true : Boolean(body.opted_out);
    }

    if (!token) return jsonResponse({ error: 'token חסר' }, 400);

    const tokenPayload = await verifyToken(token, secret);
    if (!tokenPayload) return jsonResponse({ error: 'token לא תקין' }, 400);

    const supabase = supa();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, public_id, email')
      .eq(tokenPayload.user_public_id ? 'public_id' : 'id', tokenPayload.user_public_id || tokenPayload.user_id)
      .eq('email', tokenPayload.email)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) return jsonResponse({ error: 'משתמש לא נמצא' }, 404);

    const readState = async () => {
      const [{ data: optOut }, { data: prefs }] = await Promise.all([
        supabase.from('opt_outs').select('opted_out').eq('user_id', user.id).maybeSingle(),
        supabase.from('notification_preferences').select('email').eq('user_id', user.id).maybeSingle(),
      ]);
      return {
        email: user.email,
        // Both default to on: a user with no row has never opted out.
        expiry_email: prefs?.email ?? true,
        marketing_email: !(optOut?.opted_out ?? false),
      };
    };

    if (req.method === 'GET') return jsonResponse(await readState());

    const stamp = new Date().toISOString();

    if (scope === 'marketing' || scope === 'all') {
      const { error } = await supabase.from('opt_outs').upsert(
        { user_id: user.id, opted_out: optedOut, timestamp: stamp },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
    }

    if (scope === 'expiry' || scope === 'all') {
      // The expiry channel lives in notification_preferences, which the app's
      // own settings screen edits too — the same switch, reached from a mail.
      const { error } = await supabase.from('notification_preferences').upsert(
        { user_id: user.id, email: !optedOut, updated_at: stamp },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
    }

    // RFC 8058 requires a plain 2xx here; the mail client shows its own
    // confirmation and never renders this body.
    if (isOneClick) return new Response('OK', { status: 200, headers: corsHeadersFor(req) });

    return jsonResponse({ ok: true, ...(await readState()) });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
