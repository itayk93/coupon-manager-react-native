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
