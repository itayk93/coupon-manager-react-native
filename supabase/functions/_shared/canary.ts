// Canary tokens: decoy secrets that a legitimate user never sends.
//
// Store one or more tokens in the CANARY_TOKENS env var (comma separated).
// When a canary is seen, we record the event best-effort; the caller still
// returns exactly the same response as any other invalid credential.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function isCanaryToken(candidate: string): Promise<boolean> {
  const raw = Deno.env.get('CANARY_TOKENS')?.trim();
  if (!raw || !candidate) return false;

  const tokens = raw.split(',').map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) return false;

  let mismatch = 0;
  for (const token of tokens) {
    if (token.length !== candidate.length) {
      mismatch += 1;
      continue;
    }
    let local = 0;
    for (let i = 0; i < token.length; i += 1) {
      local |= token.charCodeAt(i) ^ candidate.charCodeAt(i);
    }
    if (local === 0) return true;
  }

  return false;
}

export async function reportCanaryTrip(source: string, candidate: string): Promise<void> {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return;

    const client = createClient(url, key);
    await client.from('user_activities').insert({
      action: 'canary_token_tripped',
      extra_metadata: { source, seen_at: new Date().toISOString() },
    });
  } catch {
    // Best-effort: reporting failure must never change the endpoint's behavior.
  }
}
