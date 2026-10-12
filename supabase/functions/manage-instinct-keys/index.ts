import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { requireAdmin } from '../_shared/auth.ts';
import { corsHeadersFor } from '../_shared/cors.ts';
import { hashKey } from '../instinct-api/query.ts';

const columns = 'id,user_id,label,key_prefix,created_at,expires_at,revoked_at,last_used_at,consented_at,consent_version';
Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const admin = await requireAdmin(req);
    if (admin.id !== 1) return json({ error: 'החיבור זמין כרגע למנהל הראשי בלבד' }, 403);
    // requireAdmin validates the JWT with Auth before its assurance claim is read.
    const token = req.headers.get('authorization')!.replace(/^Bearer\s+/i, '');
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.aal !== 'aal2') return json({ error: 'נדרש אימות דו-שלבי' }, 403);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (!payload.session_id) return json({ error: 'נדרשת התחברות מחדש' }, 401);
    const session = await client.rpc('instinct_admin_session_valid', { p_session: payload.session_id, p_auth: admin.auth_user_id });
    if (session.error) throw session.error;
    if (!session.data) return json({ error: 'נדרשת התחברות מחדש' }, 401);
    let body;
    try { body = await req.json(); } catch { return json({ error: 'בקשה לא תקינה' }, 400); }
    if (!body || typeof body !== 'object') return json({ error: 'בקשה לא תקינה' }, 400);
    if (body.action === 'list') {
      const { data, error } = await client.from('instinct_api_keys').select(`${columns},users!instinct_api_keys_user_id_fkey(email,first_name,last_name)`).eq('user_id', admin.id).order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return json({ keys: data });
    }
    if (body.action === 'create') {
      if (body.consent !== true || body.consent_version !== 'instinct-decrypted-v1') return json({ error: 'נדרש אישור מפורש לשיתוף נתונים מפוענחים' }, 400);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (email !== admin.email.toLowerCase() || (body.user_id !== undefined && body.user_id !== admin.id)) return json({ error: 'אפשר לתת גישה רק לנתונים שלך' }, 403);
      const label = typeof body.label === 'string' ? body.label.trim() : '';
      const days = body.days;
      if (!email || !label || label.length > 100 || ![7,30,90].includes(days)) return json({ error: 'יש להזין אימייל, שם למפתח ותוקף תקין' }, 400);
      const { data: user, error: userError } = await client.from('users').select('id,email,is_deleted').eq('email', email).maybeSingle();
      if (userError) throw userError;
      if (!user || user.id !== admin.id || user.is_deleted) return json({ error: 'לא נמצא משתמש פעיל עם האימייל הזה' }, 404);
      const key = 'cm_instinct_' + [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
      const { data, error } = await client.from('instinct_api_keys').insert({ user_id: user.id, created_by: admin.id,
        label, consent_version: 'instinct-decrypted-v1', key_hash: await hashKey(key), key_prefix: key.slice(0,19), expires_at: new Date(Date.now()+days*86400000).toISOString() }).select(columns).single();
      if (error) throw error;
      return json({ key, record: data });
    }
    if (body.action === 'revoke') {
      if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.id)) return json({ error: 'מזהה לא תקין' }, 400);
      const { data, error } = await client.from('instinct_api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', body.id).eq('user_id', admin.id).is('revoked_at', null).select('id');
      if (error) throw error;
      if (!data?.length) return json({ error: 'המפתח לא נמצא או כבר בוטל' }, 404);
      return json({ ok: true });
    }
    return json({ error: 'פעולה לא נתמכת' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return json({ error: 'נדרשת התחברות' }, 401);
    if (message === 'FORBIDDEN') return json({ error: 'אין הרשאת מנהל' }, 403);
    console.error('manage-instinct-keys failed');
    return json({ error: 'לא ניתן להשלים את הפעולה' }, 500);
  }
});
