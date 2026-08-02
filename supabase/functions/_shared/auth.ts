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
