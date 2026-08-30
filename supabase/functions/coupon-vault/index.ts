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

async function deleteStorageFolder(
  db: ReturnType<typeof admin>,
  bucket: string,
  prefix: string,
): Promise<void> {
  for (;;) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 100, offset: 0 });
    if (error) throw error;
    const paths = (data || [])
      .filter((item) => item.id)
      .map((item) => `${prefix}/${item.name}`);
    if (!paths.length) return;
    const { error: removeError } = await db.storage.from(bucket).remove(paths);
    if (removeError) throw removeError;
  }
}

function profileImagePath(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (value.startsWith('profile-image:')) return value.slice('profile-image:'.length) || null;
  try {
    const marker = '/storage/v1/object/public/profile-images/';
    const pathname = new URL(value).pathname;
    const index = pathname.indexOf(marker);
    return index < 0 ? null : decodeURIComponent(pathname.slice(index + marker.length)) || null;
  } catch {
    return null;
  }
}

async function decryptCoupon<T extends Record<string, unknown>>(coupon: T): Promise<T> {
  const result: Record<string, unknown> = { ...coupon };
  await Promise.all(SENSITIVE.map(async (field) => {
    const value = result[field];
    if (typeof value === 'string' && value) result[field] = await decryptCouponValue(value);
  }));
  return result as T;
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
        const relatedCoupon = Array.isArray(row.coupon) ? row.coupon[0] : row.coupon;
        const coupon = relatedCoupon as unknown as Record<string, unknown> | null;
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
    // GDPR art. 7 / Israeli PPL — a demonstrable consent trail. Idempotent per
    // version: re-calling with the same version just refreshes the timestamp.
    if (body.action === 'record_consent') {
      const version = typeof body.version === 'string' && body.version.trim() ? body.version.trim().slice(0, 20) : '1.0';
      const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('cf-connecting-ip') || '').trim() || null;
      await db.from('user_consents').insert({
        user_id: user.id,
        consent_status: true,
        version,
        timestamp: new Date().toISOString(),
        ip_address: ip,
      });
      await db.from('users').update({
        privacy_consent_version: version,
        privacy_consent_at: new Date().toISOString(),
      }).eq('id', user.id);
      return jsonResponseFor(req, { data: { version } });
    }

    // GDPR art. 15 + 20 / Israeli PPL s. 13 — account data in one JSON
    // document. Coupon secrets are decrypted so the export is usable.
    if (body.action === 'export_account') {
      const ids = (await db.from('coupon').select('id').eq('user_id', user.id)).data?.map((r) => r.id) ?? [];
      const grab = async (table: string, column: string, value: unknown) => {
        const { data, error } = await db.from(table).select('*').eq(column, value);
        if (error) throw error;
        return data ?? [];
      };

      const [profile, coupons, usage, transactions, tags, activities, consents, optOuts, notifications, notifPrefs, gptUsage, referralCodes, pushSubscriptions, tourProgress, notificationEvents, couponAlerts, newsletterSendings, autoUpdateRuns, referralApplications, ownReferral, usageImports] = await Promise.all([
        db.from('users').select('id,public_id,auth_user_id,email,first_name,last_name,gender,created_at,profile_description,profile_image,google_id,newsletter_subscription,marketing_consent_at,marketing_consent_source,marketing_consent_version,telegram_monthly_summary,allow_widget_access,push_token,privacy_consent_version,privacy_consent_at').eq('id', user.id).maybeSingle(),
        db.from('coupon').select('*').eq('user_id', user.id),
        ids.length ? db.from('coupon_usage').select('*').in('coupon_id', ids) : Promise.resolve({ data: [] }),
        ids.length ? db.from('coupon_transaction').select('*').in('coupon_id', ids) : Promise.resolve({ data: [] }),
        ids.length ? db.from('coupon_tags').select('coupon_id, tag:tag_id(name)').in('coupon_id', ids) : Promise.resolve({ data: [] }),
        grab('user_activities', 'user_id', user.id),
        grab('user_consents', 'user_id', user.id),
        grab('opt_outs', 'user_id', user.id),
        grab('notifications', 'user_id', user.id),
        grab('notification_preferences', 'user_id', user.id),
        grab('gpt_usage', 'user_id', user.id),
        grab('referral_codes', 'user_id', user.id),
        grab('push_subscriptions', 'user_id', user.id),
        grab('user_tour_progress', 'user_id', user.id),
        grab('notification_events', 'user_id', user.id),
        grab('coupon_alerts', 'user_id', user.id),
        grab('newsletter_sendings', 'user_id', user.id),
        grab('auto_update_runs', 'user_id', user.id),
        grab('referral_applications', 'user_id', user.id),
        grab('referrals', 'referred_user_id', user.id),
        grab('coupon_usage_imports', 'user_id', user.id),
      ]);

      const shares = await db.from('coupon_shares').select('*').or(`shared_by_user_id.eq.${user.id},shared_with_user_id.eq.${user.id}`);
      let exportedProfile: Record<string, unknown> | null = profile.data
        ? { ...profile.data }
        : null;
      const imagePath = profileImagePath(exportedProfile?.profile_image);
      if (exportedProfile && imagePath) {
        const { data: signedImage, error: signedImageError } = await db.storage
          .from('profile-images').createSignedUrl(imagePath, 60 * 60);
        if (signedImageError) throw signedImageError;
        exportedProfile = {
          ...exportedProfile,
          profile_image_download_url: signedImage.signedUrl,
          profile_image_download_url_expires_in_seconds: 60 * 60,
        };
      }

      return jsonResponseFor(req, {
        data: {
          exported_at: new Date().toISOString(),
          profile: exportedProfile,
          coupons: await Promise.all((coupons.data || []).map(decryptCoupon)),
          coupon_usage: usage.data ?? [],
          coupon_transactions: transactions.data ?? [],
          coupon_tags: tags.data ?? [],
          coupon_shares: shares.data ?? [],
          activity_log: activities,
          consents,
          marketing_opt_outs: optOuts,
          notifications,
          notification_preferences: notifPrefs,
          ai_usage: gptUsage,
          referral_codes: referralCodes,
          push_subscriptions: pushSubscriptions,
          tour_progress: tourProgress,
          notification_events: notificationEvents,
          coupon_alerts: couponAlerts,
          newsletter_sendings: newsletterSendings,
          automatic_update_runs: autoUpdateRuns,
          referral_applications: referralApplications,
          referral_attribution: ownReferral,
          coupon_usage_imports: usageImports,
        },
      });
    }

    // GDPR art. 17 / Israeli PPL s. 14 — immediate, complete erasure.
    if (body.action === 'delete_account') {
      const { data: account, error: accountError } = await db.from('users')
        .select('auth_user_id').eq('id', user.id).single();
      if (accountError) throw accountError;
      const authUserId = user.auth_user_id || account.auth_user_id;
      if (!authUserId) throw new Error('AUTH_ID_NOT_FOUND');
      if (!account.auth_user_id) {
        const { error: authLinkError } = await db.from('users')
          .update({ auth_user_id: authUserId }).eq('id', user.id);
        if (authLinkError) throw authLinkError;
      }
      // Storage objects are not database rows and do not follow SQL cascades.
      // Delete them first; a failure must not be reported as full erasure.
      await deleteStorageFolder(db, 'profile-images', authUserId);
      const { error } = await db.rpc('delete_account_data', { p_user_id: user.id });
      if (error) throw error;
      return jsonResponseFor(req, { data: { deleted: true } });
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
