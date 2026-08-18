import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function requireUser(req: Request) {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error('UNAUTHENTICATED');
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user?.email) throw new Error('UNAUTHENTICATED');
  const result = await client.from('users').select('id,email,is_admin,is_deleted').eq('email', user.email.toLowerCase()).maybeSingle();
  if (result.error || !result.data || result.data.is_deleted) throw new Error('FORBIDDEN');
  return result.data;
}

export function requireSameUser(requestedId: unknown, authenticatedId: number) {
  if (Number(requestedId) !== authenticatedId) throw new Error('FORBIDDEN');
}

/** Like requireUser, but also demands the admin flag on the resolved row. */
export async function requireAdmin(req: Request) {
  const user = await requireUser(req);
  if (!user.is_admin) throw new Error('FORBIDDEN');
  return user;
}

/**
 * Optional network-level guard for admin endpoints. Reads one env var:
 *   ADMIN_IP_ALLOWLIST=1.2.3.4,10.0.0.0/24
 *
 * Fails open when the env var is missing, so a lost/mis-typed secret never
 * locks every admin out of production. When configured, unknown IPs are
 * rejected.
 */
export function extractClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

function ipMatches(ip: string, entry: string): boolean {
  const normalizedEntry = entry.trim();
  if (normalizedEntry.includes('/')) {
    const [network, bitsRaw] = normalizedEntry.split('/');
    const bits = Number(bitsRaw);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    return ipV4ToInt(ip) !== null && ipV4ToInt(network) !== null &&
      ((ipV4ToInt(ip)! ^ ipV4ToInt(network)!) >>> (32 - bits)) === 0;
  }
  return ip === normalizedEntry;
}

function ipV4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const bytes = parts.map(Number);
  if (bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) return null;
  return ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
}

export function isAdminIpAllowed(req: Request): boolean {
  const raw = Deno.env.get('ADMIN_IP_ALLOWLIST')?.trim();
  if (!raw) return true;

  const entries = raw.split(',').map((entry) => entry.trim()).filter(Boolean);
  const ip = extractClientIp(req);
  if (ip === 'unknown') return false;
  return entries.some((entry) => ipMatches(ip, entry));
}

/**
 * True when the caller presented the service role key itself, which is how
 * scheduled jobs (pg_cron -> functions.supabase.co) reach a function. Never
 * true for a browser: the key is server-side only.
 */
export function isServiceRoleCall(req: Request): boolean {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !serviceKey || token.length !== serviceKey.length) return false;

  let mismatch = 0;
  for (let i = 0; i < token.length; i += 1) mismatch |= token.charCodeAt(i) ^ serviceKey.charCodeAt(i);
  return mismatch === 0;
}
