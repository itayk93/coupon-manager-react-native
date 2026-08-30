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

function publicId(value: unknown): string | null {
  const id = typeof value === 'string' ? value.trim() : '';
  return /^cpn_[0-9a-f]{20}$/.test(id) ? id : null;
}

function assertIds(value: unknown): number[] {
  const list = Array.isArray(value) ? value : [value];
  const ids = list.map(assertId);
  if (!ids.length || ids.length > 200) throw new Error('INVALID_INPUT');
  return Array.from(new Set(ids));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeadersFor(req) });
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const db = admin();

    if (body.action === 'list') {
      const { data: owned, error: ownedError } = await db.from('coupon').select('*').eq('user_id', user.id).is('deleted_at', null);
      if (ownedError) throw ownedError;

      const { data: sharedRows, error: sharedError } = await db
        .from('coupon_shares')
        .select('coupon:coupon_id(*)')
        .eq('shared_with_user_id', user.id)
        .eq('share_type', 'shared')
        .eq('status', 'accepted')
        .gt('share_expires_at', new Date().toISOString());
      if (sharedError) throw sharedError;

      const byId = new Map<number, Record<string, unknown>>();
      for (const coupon of owned || []) byId.set(coupon.id, { ...coupon, is_shared_with_me: false });
      for (const row of sharedRows || []) {
        const coupon = row.coupon as Record<string, unknown> | null;
        // The owner may have moved a shared coupon to their trash.
        if (coupon && typeof coupon.id === 'number' && !coupon.deleted_at && !byId.has(coupon.id)) {
          byId.set(coupon.id, { ...coupon, is_shared_with_me: true });
        }
      }

      const coupons = Array.from(byId.values()).sort((a, b) =>
        String(b.date_added || '').localeCompare(String(a.date_added || ''))
      );
      return jsonResponseFor(req, { data: await Promise.all(coupons.map(decryptCoupon)) });
    }
    if (body.action === 'get') {
      const opaqueId = publicId(body.publicId);
      const query = db.from('coupon').select('*');
      const { data, error } = opaqueId
        ? await query.eq('public_id', opaqueId).maybeSingle()
        : await query.eq('id', assertId(body.id)).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('NOT_FOUND');
      let isSharedWithMe = false;
      if (data.user_id !== user.id) {
        const { data: grant } = await db.from('coupon_shares').select('id')
          .eq('coupon_id', data.id).eq('shared_with_user_id', user.id)
          .eq('share_type', 'shared').eq('status', 'accepted')
          .gt('share_expires_at', new Date().toISOString()).maybeSingle();
        if (!grant) throw new Error('NOT_FOUND');
        isSharedWithMe = true;
      }
      return jsonResponseFor(req, { data: await decryptCoupon({ ...data, is_shared_with_me: isSharedWithMe }) });
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
    // Soft delete: move coupons to the "recently deleted" holding area. The
    // nightly purge_soft_deleted_coupons() job clears them after 30 days.
    if (body.action === 'soft_delete') {
      const ids = assertIds(body.ids ?? body.id);
      const { data, error } = await db.from('coupon')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids).eq('user_id', user.id).is('deleted_at', null)
        .select('id');
      if (error) throw error;
      return jsonResponseFor(req, { data: { ids: (data || []).map((r) => r.id) } });
    }
    if (body.action === 'restore') {
      const ids = assertIds(body.ids ?? body.id);
      const { data, error } = await db.from('coupon')
        .update({ deleted_at: null })
        .in('id', ids).eq('user_id', user.id).not('deleted_at', 'is', null)
        .select('id');
      if (error) throw error;
      return jsonResponseFor(req, { data: { ids: (data || []).map((r) => r.id) } });
    }
    // Hard delete, only from the trash — a coupon still in the wallet cannot be
    // permanently removed without first soft-deleting it.
    if (body.action === 'hard_delete') {
      const ids = assertIds(body.ids ?? body.id);
      const { data, error } = await db.from('coupon')
        .delete()
        .in('id', ids).eq('user_id', user.id).not('deleted_at', 'is', null)
        .select('id');
      if (error) throw error;
      return jsonResponseFor(req, { data: { ids: (data || []).map((r) => r.id) } });
    }
    if (body.action === 'list_deleted') {
      const { data, error } = await db.from('coupon').select('*')
        .eq('user_id', user.id).not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return jsonResponseFor(req, { data: await Promise.all((data || []).map(decryptCoupon)) });
    }
    if (body.action === 'shared_with_me') {
      const { data, error } = await db.from('coupon_shares').select('*, coupon:coupon_id(id,public_id,company,description,value,used_value,code,expiration), shared_by:shared_by_user_id(email,first_name,last_name)').eq('shared_with_user_id', user.id).in('status', ['pending', 'accepted']).gt('share_expires_at', new Date().toISOString()).order('created_at', { ascending: false });
      if (error) throw error;
      const hydrated = await Promise.all((data || []).map(async (share) => {
        const coupon = share.coupon ? await decryptCoupon(share.coupon) : null;
        // Invitation reveals its subject, not its secret. Code becomes visible
        // only after the recipient explicitly accepts.
        if (coupon && share.status === 'pending') coupon.code = null;
        return { ...share, coupon };
      }));
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
      const shareType = body.shareType === 'transfer' ? 'transfer' : body.shareType === 'shared' ? 'shared' : null;
      if (!/^\S+@\S+\.\S+$/.test(email) || !shareType) throw new Error('INVALID_INPUT');
      const { data: coupon } = await db.from('coupon').select('id').eq('id', couponId).eq('user_id', user.id).maybeSingle();
      if (!coupon) throw new Error('NOT_FOUND');
      const { data: target } = await db.from('users').select('id').eq('email', email).maybeSingle();
      if (!target || target.id === user.id) throw new Error('RECIPIENT_NOT_FOUND');
      const { data: existing } = await db.from('coupon_shares').select('id')
        .eq('coupon_id', couponId).eq('shared_with_user_id', target.id)
        .in('status', ['pending', 'accepted']).maybeSingle();
      if (existing) throw new Error('SHARE_ALREADY_EXISTS');
      const expires = new Date(); expires.setDate(expires.getDate() + 30);
      const { data, error } = await db.from('coupon_shares').insert({ coupon_id: couponId, shared_by_user_id: user.id, shared_with_user_id: target.id, recipient_email: email, share_type: shareType, share_token: crypto.randomUUID(), share_expires_at: expires.toISOString(), status: 'pending', created_at: new Date().toISOString() }).select('id').single();
      if (error) throw error;
      // Invitation and mail are one server-side workflow. Waiting here avoids
      // losing the mail when the app closes immediately after the mutation.
      let emailSent = false;
      try {
        const notificationResponse = await fetch(`${Deno.env.get('SUPABASE_URL')!}/functions/v1/notify-event`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: req.headers.get('Authorization') || '',
          },
          body: JSON.stringify({ event: 'share_received', couponId, recipientEmail: email }),
        });
        const notification = await notificationResponse.json();
        emailSent = notificationResponse.ok && notification?.result?.email === true;
      } catch (notificationError) {
        console.error('coupon-vault invitation notification', notificationError);
      }
      return jsonResponseFor(req, { data: { ...data, emailSent } }, 201);
    }
    if (body.action === 'respond_to_share') {
      const id = assertId(body.id);
      if (typeof body.accept !== 'boolean') throw new Error('INVALID_INPUT');
      const callerDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await callerDb.rpc('respond_to_coupon_share', { p_share_id: id, p_accept: body.accept });
      if (error) throw error;
      return jsonResponseFor(req, { data: data?.[0] || null });
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
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : message === 'NOT_FOUND' ? 404 : message === 'SHARE_ALREADY_EXISTS' ? 409 : message.startsWith('INVALID_') || message === 'RECIPIENT_NOT_FOUND' ? 400 : 500;
    console.error('coupon-vault', message);
    return jsonResponseFor(req, { error: message }, status);
  }
});
