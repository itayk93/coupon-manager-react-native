// Shared CORS configuration for all Edge Functions.
//
// Origin is taken from one place: the CORS_ALLOWED_ORIGINS env var (comma
// separated). When unset it falls back to `*` to stay backward-compatible with
// mobile clients that do not send an Origin header. Set it before tightening
// production, for example:
//   CORS_ALLOWED_ORIGINS=https://coupons.itaykarkason.com,http://localhost:5173

const ALLOWED_ORIGINS = (Deno.env.get('CORS_ALLOWED_ORIGINS') || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export function corsOriginFor(request: Request): string {
  const origin = request.headers.get('origin');
  if (!origin) return '*';
  if (ALLOWED_ORIGINS.length === 0) return '*';
  return ALLOWED_ORIGINS.includes(origin) ? origin : '*';
}

export function corsHeadersFor(request: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': corsOriginFor(request),
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Kept for call sites that only have a Response body and no Request at hand.
// Without a request there is no Origin to reflect, so a configured single
// origin is used; otherwise it stays open for mobile clients.
export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] || '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function jsonResponseFor(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(request), 'Content-Type': 'application/json' },
  });
}
