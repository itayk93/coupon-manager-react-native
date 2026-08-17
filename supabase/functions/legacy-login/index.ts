// Server-side login for the legacy (Flask/Werkzeug) user table.
//
// Replaces the previous flow, where the browser fetched the password hash from
// public.users with the anon key and compared it locally. Here the hash never
// leaves the server, and the caller gets a real Supabase session, so RLS can
// finally be expressed in terms of auth.uid().
//
// The matching auth.users row is created lazily on first successful login and
// linked back to public.users.auth_user_id.

import { pbkdf2Async } from 'https://esm.sh/@noble/hashes@1.5.0/pbkdf2';
import { scryptAsync } from 'https://esm.sh/@noble/hashes@1.5.0/scrypt';
import { sha256, sha512 } from 'https://esm.sh/@noble/hashes@1.5.0/sha2';
import { utf8ToBytes } from 'https://esm.sh/@noble/hashes@1.5.0/utils';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { adminClient, issueSessionToken } from '../_shared/session.ts';

const supabaseAdmin = adminClient();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/** Verifies a Werkzeug `method$salt$hex` hash. Mirrors src/lib/werkzeug.ts. */
async function checkWerkzeugPasswordHash(storedHash: string, password: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;

  const [methodSpec, salt, expectedHash] = parts;
  if (!methodSpec || !salt || !/^[a-f0-9]+$/i.test(expectedHash) || expectedHash.length % 2 !== 0) {
    return false;
  }

  const methodParts = methodSpec.split(':');
  const passwordBytes = utf8ToBytes(password);
  const saltBytes = utf8ToBytes(salt);
  const dkLen = expectedHash.length / 2;

  if (methodParts[0] === 'pbkdf2') {
    const digestName = methodParts[1] || 'sha256';
    const iterations = Number(methodParts[2] || 1000000);
    if (!isPositiveInteger(iterations)) return false;
    if (digestName !== 'sha256' && digestName !== 'sha512') return false;
    const derived = await pbkdf2Async(digestName === 'sha512' ? sha512 : sha256, passwordBytes, saltBytes, {
      c: iterations,
      dkLen,
    });
    return timingSafeEqual(toHex(derived), expectedHash);
  }

  if (methodParts[0] === 'scrypt') {
    const N = Number(methodParts[1] || 32768);
    const r = Number(methodParts[2] || 8);
    const p = Number(methodParts[3] || 1);
    if (!isPositiveInteger(N) || !isPositiveInteger(r) || !isPositiveInteger(p)) return false;
    const derived = await scryptAsync(passwordBytes, saltBytes, { N, r, p, dkLen });
    return timingSafeEqual(toHex(derived), expectedHash);
  }

  return false;
}

const INVALID_CREDENTIALS = 'אימייל או סיסמה שגויים.';
const TOO_MANY_ATTEMPTS = 'יותר מדי ניסיונות התחברות. נסה שוב בעוד 15 דקות.';

/** Failed attempts allowed per email inside the window before it locks. */
const MAX_FAILED_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MINUTES = 15;

/**
 * Both helpers fail open: if `auth_login_attempts` is unreachable, login keeps
 * working. A throttle that can lock everybody out on an infrastructure blip is
 * worse than the brute-force risk it removes.
 */
async function isLockedOut(email: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count, error } = await supabaseAdmin
      .from('auth_login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('email', email)
      .eq('succeeded', false)
      .gte('attempted_at', since);

    if (error) return false;
    return (count ?? 0) >= MAX_FAILED_ATTEMPTS;
  } catch {
    return false;
  }
}

async function recordAttempt(email: string, succeeded: boolean): Promise<void> {
  try {
    await supabaseAdmin
      .from('auth_login_attempts')
      .insert({ email, succeeded, attempted_at: new Date().toISOString() });
  } catch {
    // ignore
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');

    if (!email || !password) return jsonResponse({ error: INVALID_CREDENTIALS }, 400);

    if (await isLockedOut(email)) {
      return jsonResponse({ error: TOO_MANY_ATTEMPTS }, 429);
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id,email,password,first_name,last_name,is_admin,is_confirmed,is_deleted,auth_user_id')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;

    // Same response for "no such user" and "wrong password" so the endpoint
    // cannot be used to enumerate registered addresses.
    if (!user || !user.password) {
      await recordAttempt(email, false);
      return jsonResponse({ error: INVALID_CREDENTIALS }, 401);
    }
    if (user.is_deleted) return jsonResponse({ error: 'המשתמש הזה נמחק או נחסם.' }, 403);

    if (!(await checkWerkzeugPasswordHash(user.password, password))) {
      await recordAttempt(email, false);
      return jsonResponse({ error: INVALID_CREDENTIALS }, 401);
    }

    await recordAttempt(email, true);

    if (!user.is_confirmed) {
      return jsonResponse({ error: 'עליך לאשר את חשבונך לפני התחברות.' }, 403);
    }

    const tokenHash = await issueSessionToken(supabaseAdmin, user.id, user.email, user.auth_user_id);

    return jsonResponse({
      token_hash: tokenHash,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: Boolean(user.is_admin),
        is_confirmed: Boolean(user.is_confirmed),
      },
    });
  } catch (err) {
    console.error('legacy-login failed', err);
    return jsonResponse({ error: 'ההתחברות נכשלה. נסה שוב.' }, 500);
  }
});
