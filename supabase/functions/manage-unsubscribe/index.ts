import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';

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

  const payloadBytes = fromBase64Url(payloadPart);
  const payload = new TextDecoder().decode(payloadBytes);
  const expectedSignature = await signPayload(payload, secret);
  if (!timingSafeEqual(expectedSignature, signaturePart)) return null;

  const parsed = JSON.parse(payload) as { user_id?: number; email?: string; type?: string };
  if (!parsed.user_id || !parsed.email || parsed.type !== 'unsubscribe') return null;
  return parsed;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) });

  try {
    const secret = Deno.env.get('UNSUBSCRIBE_SECRET');
    if (!secret) return jsonResponse({ error: 'UNSUBSCRIBE_SECRET not configured' }, 500);

    const { token, opted_out } = await req.json();
    if (!token) return jsonResponse({ error: 'token חסר' }, 400);

    const tokenPayload = await verifyToken(token, secret);
    if (!tokenPayload) return jsonResponse({ error: 'token לא תקין' }, 400);

    const supabase = supa();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', tokenPayload.user_id)
      .eq('email', tokenPayload.email)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) return jsonResponse({ error: 'משתמש לא נמצא' }, 404);

    const { error } = await supabase
      .from('opt_outs')
      .upsert(
        { user_id: user.id, opted_out: Boolean(opted_out), timestamp: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) throw error;

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
