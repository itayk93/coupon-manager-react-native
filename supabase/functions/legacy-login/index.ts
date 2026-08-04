// Server-side login for the legacy (Flask/Werkzeug) user table.
//
// Replaces the previous flow, where the browser fetched the password hash from
// public.users with the anon key and compared it locally. Here the hash never
// leaves the server, and the caller gets a real Supabase session, so RLS can
// finally be expressed in terms of auth.uid().
//
// The matching auth.users row is created lazily on first successful login and
// linked back to public.users.auth_user_id.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { pbkdf2Async } from 'https://esm.sh/@noble/hashes@1.5.0/pbkdf2';
import { scryptAsync } from 'https://esm.sh/@noble/hashes@1.5.0/scrypt';
import { sha256, sha512 } from 'https://esm.sh/@noble/hashes@1.5.0/sha2';
import { utf8ToBytes } from 'https://esm.sh/@noble/hashes@1.5.0/utils';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

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

/**
 * Ensures an auth.users row exists for this legacy user and returns a session.
 * The auth password is a server-generated random value that nobody ever sees;
 * the legacy Werkzeug hash stays the single source of truth for the check
 * above, so users keep their existing passwords.
 */
async function issueSession(userId: number, email: string, authUserId: string | null) {
  let authId = authUserId;

  if (!authId) {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: { legacy_user_id: userId },
    });

    if (createError) {
      // Another concurrent login (or the Google flow) may have created it first.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
      if (!existing) throw createError;
      authId = existing.id;
    } else {
      authId = created.user.id;
    }

    const { error: linkError } = await supabaseAdmin
      .from('users')
      .update({ auth_user_id: authId })
      .eq('id', userId);
    if (linkError) throw linkError;
  }

  // A magic-link token is the only way to mint a session for a user whose
  // password we do not know. The client immediately exchanges it via verifyOtp.
  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkError) throw linkError;

  return link.properties.hashed_token;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');

    if (!email || !password) return jsonResponse({ error: INVALID_CREDENTIALS }, 400);

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id,email,password,first_name,last_name,is_admin,is_confirmed,is_deleted,auth_user_id')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;

    // Same response for "no such user" and "wrong password" so the endpoint
    // cannot be used to enumerate registered addresses.
    if (!user || !user.password) return jsonResponse({ error: INVALID_CREDENTIALS }, 401);
    if (user.is_deleted) return jsonResponse({ error: 'המשתמש הזה נמחק או נחסם.' }, 403);

    if (!(await checkWerkzeugPasswordHash(user.password, password))) {
      return jsonResponse({ error: INVALID_CREDENTIALS }, 401);
    }

    if (!user.is_confirmed) {
      return jsonResponse({ error: 'עליך לאשר את חשבונך לפני התחברות.' }, 403);
    }

    const tokenHash = await issueSession(user.id, user.email, user.auth_user_id);

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
