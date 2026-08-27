// Supabase Edge Function: claim-referral
//
// Attaches the caller to the referral chain of whoever's link they opened.
//
// It exists rather than an RPC from the app for two reasons. The account comes
// from the JWT, never the body — an attribution the client can address is a
// partner's balance the client can inflate. And the install id is hashed here
// with a server-side pepper, so the database holds a fingerprint that can be
// compared against other rows but never read back to a device.
//
// Called once after registration, and idempotent: the first claim wins and
// every later one is told the same thing.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected automatically),
//           REFERRAL_INSTALL_PEPPER (optional; without it install ids are not
//           stored at all, rather than stored unsalted).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { normalizeReferralCode } from '../_shared/referralCodes.ts';

async function hashInstallId(installId: string): Promise<string | null> {
  const pepper = Deno.env.get('REFERRAL_INSTALL_PEPPER');
  // An unsalted hash of a UUID is the UUID: anyone with the table could
  // confirm a guess. No pepper configured means no fraud signal, which is a
  // smaller loss than a column that pretends to be anonymous.
  if (!pepper) return null;
  const bytes = new TextEncoder().encode(`${installId}:${pepper}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) });

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

    const user = await requireUser(req);
    const body = await req.json().catch(() => null);

    const code = normalizeReferralCode(body?.code);
    if (!code) return jsonResponse({ status: 'invalid_code' });

    const installId = typeof body?.install_id === 'string' ? body.install_id.slice(0, 100) : null;
    const installHash = installId ? await hashInstallId(installId) : null;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data, error } = await supabase.rpc('claim_referral', {
      p_user_id: user.id,
      p_code: code,
      p_install_hash: installHash,
    });

    if (error) {
      console.error('[claim-referral] rpc failed:', error.message);
      return jsonResponse({ error: 'INTERNAL_ERROR' }, 500);
    }

    // Every outcome is a 200 with a word. The app must not fail a sign-up over
    // a stale link, and a caller must not be able to probe whose code is live
    // by watching status codes.
    return jsonResponse({ status: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'INTERNAL_ERROR';
    if (message === 'UNAUTHENTICATED') return jsonResponse({ error: message }, 401);
    if (message === 'FORBIDDEN') return jsonResponse({ error: message }, 403);
    console.error('[claim-referral] unexpected:', message);
    return jsonResponse({ error: 'INTERNAL_ERROR' }, 500);
  }
});
