import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser } from '../_shared/auth.ts';
import { corsHeadersFor, jsonResponseFor } from '../_shared/cors.ts';
import { decryptCouponValue, encryptCouponValue } from '../_shared/encryption.ts';

const SENSITIVE = ['code', 'description', 'buyme_coupon_url', 'strauss_coupon_url', 'xgiftcard_coupon_url', 'xtra_coupon_url', 'cvv', 'card_exp'] as const;
const WRITABLE = new Set([
  'company', ...SENSITIVE, 'value', 'cost', 'used_value', 'status', 'expiration', 'date_added',
  'is_one_time', 'purpose', 'auto_download_details', 'auto_update', 'last_scraped',
  'last_detail_view', 'last_company_view', 'last_code_view', 'show_in_widget', 'widget_display_order', 'source',
]);

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function decryptCoupon<T extends Record<string, unknown>>(coupon: T): Promise<T> {
  const result = { ...coupon };
  await Promise.all(SENSITIVE.map(async (field) => {
    const value = result[field];
    if (typeof value === 'string' && value) result[field] = await decryptCouponValue(value) as T[typeof field];
  }));
  return result;
}

async function encryptedInput(input: unknown): Promise<Record<string, unknown>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_INPUT');
  const result: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(input)) {
    if (!WRITABLE.has(field)) continue;
    result[field] = SENSITIVE.includes(field as typeof SENSITIVE[number]) && typeof value === 'string' && value
      ? await encryptCouponValue(value)
      : value;
  }
  return result;
}

function assertId(value: unknown): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('INVALID_INPUT');
  return id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeadersFor(req) });
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const db = admin();

    if (body.action === 'list') {
      const { data, error } = await db.from('coupon').select('*').eq('user_id', user.id).order('date_added', { ascending: false });
      if (error) throw error;
      return jsonResponseFor(req, { data: await Promise.all((data || []).map(decryptCoupon)) });
    }
    if (body.action === 'get') {
      const id = assertId(body.id);
      const { data, error } = await db.from('coupon').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('NOT_FOUND');
      return jsonResponseFor(req, { data: await decryptCoupon(data) });
    }
    if (body.action === 'create') {
      const input = await encryptedInput(body.coupon);
      if (typeof input.company !== 'string' || !input.company.trim() || typeof input.code !== 'string' || !input.code) throw new Error('INVALID_INPUT');
      const { data, error } = await db.from('coupon').insert({ ...input, user_id: user.id }).select('*').single();
      if (error) throw error;
      return jsonResponseFor(req, { data: await decryptCoupon(data) }, 201);
    }
    if (body.action === 'update') {
      const id = assertId(body.id);
      const { data: owned } = await db.from('coupon').select('id').eq('id', id).eq('user_id', user.id).maybeSingle();
      if (!owned) throw new Error('NOT_FOUND');
      const input = await encryptedInput(body.updates);
      const { data, error } = await db.from('coupon').update(input).eq('id', id).eq('user_id', user.id).select('*').single();
      if (error) throw error;
      return jsonResponseFor(req, { data: await decryptCoupon(data) });
    }
    if (body.action === 'shared_with_me') {
      const { data, error } = await db.from('coupon_shares').select('*, coupon:coupon_id(id,company,description,value,used_value,code,expiration), shared_by:shared_by_user_id(email,first_name,last_name)').eq('shared_with_user_id', user.id).eq('status', 'accepted').gt('share_expires_at', new Date().toISOString()).order('created_at', { ascending: false });
      if (error) throw error;
      const hydrated = await Promise.all((data || []).map(async (share) => ({ ...share, coupon: share.coupon ? await decryptCoupon(share.coupon) : null })));
      return jsonResponseFor(req, { data: hydrated });
    }
    if (body.action === 'my_shares') {
      const { data, error } = await db.from('coupon_shares').select('*, coupon:coupon_id(id,company,description,value,used_value,expiration), shared_with:shared_with_user_id(email,first_name,last_name)').eq('shared_by_user_id', user.id).neq('status', 'revoked').order('created_at', { ascending: false });
      if (error) throw error;
      const hydrated = await Promise.all((data || []).map(async (share) => ({ ...share, coupon: share.coupon ? await decryptCoupon(share.coupon) : null })));
      return jsonResponseFor(req, { data: hydrated });
    }
    if (body.action === 'create_share') {
      const couponId = assertId(body.couponId);
      const email = String(body.recipientEmail || '').trim().toLowerCase();
      const { data: coupon } = await db.from('coupon').select('id').eq('id', couponId).eq('user_id', user.id).maybeSingle();
      if (!coupon) throw new Error('NOT_FOUND');
      const { data: target } = await db.from('users').select('id').eq('email', email).maybeSingle();
      if (!target || target.id === user.id) throw new Error('RECIPIENT_NOT_FOUND');
      const expires = new Date(); expires.setDate(expires.getDate() + 30);
      const { data, error } = await db.from('coupon_shares').insert({ coupon_id: couponId, shared_by_user_id: user.id, shared_with_user_id: target.id, share_token: crypto.randomUUID(), share_expires_at: expires.toISOString(), status: 'accepted', created_at: new Date().toISOString() }).select('id').single();
      if (error) throw error;
      return jsonResponseFor(req, { data }, 201);
    }
    if (body.action === 'revoke_share') {
      const id = assertId(body.id);
      const { data, error } = await db.from('coupon_shares').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', id).eq('shared_by_user_id', user.id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('NOT_FOUND');
      return jsonResponseFor(req, { data });
    }
    throw new Error('INVALID_ACTION');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : message === 'NOT_FOUND' ? 404 : message.startsWith('INVALID_') || message === 'RECIPIENT_NOT_FOUND' ? 400 : 500;
    console.error('coupon-vault', message);
    return jsonResponseFor(req, { error: message }, status);
  }
});
