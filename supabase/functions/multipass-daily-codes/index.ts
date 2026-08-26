import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptCouponValue } from '../_shared/encryption.ts';
import { corsHeadersFor, jsonResponseFor } from '../_shared/cors.ts';
import { sendPushToUser } from '../_shared/push.ts';

const TOKEN_SHA256 = '1a0a0f98c12e7e45bd4876fbc8c399861ee4fdbb17c3350bd47a45f15d3d1303';
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

type CouponRow = {
  id: number;
  company: string;
  code: string;
  status: string;
  auto_download_details: string | null;
  last_scraped: string | null;
  last_detail_view: string | null;
  last_company_view: string | null;
  last_code_view: string | null;
};

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function requireDailyToken(req: Request) {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  if (!token || await sha256(token) !== TOKEN_SHA256) throw new Error('UNAUTHENTICATED');
}

function shouldUpdateCoupon(coupon: CouponRow): boolean {
  if (coupon.status !== 'פעיל') return false;
  if (coupon.auto_download_details !== 'Multipass') return false;
  if (!coupon.last_scraped) return true;
  const lastScraped = Date.parse(coupon.last_scraped);
  const views = [coupon.last_detail_view, coupon.last_company_view, coupon.last_code_view]
    .filter(Boolean)
    .map((value) => Date.parse(value as string))
    .filter(Number.isFinite);
  return views.length > 0 && Math.max(...views) > lastScraped;
}

function normalizePlace(value: string) {
  return value.trim().toLocaleLowerCase('he-IL').replace(/["'׳״.,()-]/g, ' ').replace(/\s+/g, ' ');
}

function geocodeQueries(query: string) {
  return [...new Set([`${query}, ישראל`, query].filter((value) => value.trim().length >= 3))];
}

async function geocodeAddress(query: string) {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) return null;
  const db = adminClient();
  const normalizedName = normalizePlace(query);

  const { data: cached } = await db.from('coupon_places')
    .select('place_name,place_address,latitude,longitude,google_place_id')
    .eq('normalized_name', normalizedName)
    .maybeSingle();
  if (cached?.place_address && cached.latitude !== null && cached.longitude !== null) {
    return {
      place_name: cached.place_name || query,
      place_address: cached.place_address,
      latitude: Number(cached.latitude),
      longitude: Number(cached.longitude),
    };
  }

  for (const addressQuery of geocodeQueries(query)) {
    const url = new URL(GOOGLE_GEOCODE_URL);
    url.searchParams.set('address', addressQuery);
    url.searchParams.set('region', 'il');
    url.searchParams.set('language', 'iw');
    url.searchParams.set('key', apiKey);
    const response = await fetch(url, { redirect: 'error' });
    if (!response.ok) continue;
    const data = await response.json();
    const result = data?.results?.[0];
    const location = result?.geometry?.location;
    if (data?.status === 'OK' && result && location) {
      const place = {
        place_name: cached?.place_name || query,
        place_address: String(result.formatted_address || addressQuery).trim(),
        latitude: Number(location.lat),
        longitude: Number(location.lng),
      };
      await db.from('coupon_places').upsert({
        normalized_name: normalizedName,
        place_name: place.place_name,
        place_address: place.place_address,
        latitude: place.latitude,
        longitude: place.longitude,
        google_place_id: cached?.google_place_id || null,
        source: 'google_geocoding',
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'normalized_name' });
      return place;
    }
  }

  const response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.id',
    },
    body: JSON.stringify({
      textQuery: `${query}, ישראל`,
      languageCode: 'he',
      regionCode: 'IL',
      maxResultCount: 1,
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const candidate = data?.places?.[0];
  const location = candidate?.location;
  if (!candidate || !location) return null;

  const place = {
    place_name: String(candidate.displayName?.text || query).trim(),
    place_address: String(candidate.formattedAddress || '').trim(),
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  };
  await db.from('coupon_places').upsert({
    normalized_name: normalizedName,
    place_name: place.place_name,
    place_address: place.place_address,
    latitude: place.latitude,
    longitude: place.longitude,
    google_place_id: candidate.id || null,
    source: 'google_places_new',
    last_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'normalized_name' });
  return place;
}

async function notifyUsage(body: Record<string, unknown>) {
  const userId = Number(body.user_id);
  const delta = Number(body.delta || 0);
  const couponId = Number(body.coupon_id);
  const company = String(body.company || 'קופון').trim();
  if (!Number.isSafeInteger(userId) || userId <= 0 || delta <= 0) throw new Error('INVALID_INPUT');

  const message = `זוהה שימוש חדש ב-${company}: ${delta.toFixed(2)} ₪`;
  const db = adminClient();
  await db.from('notifications').insert({
    user_id: userId,
    message,
    link: couponId > 0 ? `/coupons/${couponId}` : '/notifications',
    shown: false,
    viewed: false,
    hide_from_view: false,
  });

  const push = await sendPushToUser(db, userId, {
    title: 'קופון מאסטר',
    body: message,
    url: couponId > 0 ? `/coupons/${couponId}` : '/notifications',
    tag: `multipass-usage-${userId}`,
    renotify: true,
  });
  return { message, push };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) });
  try {
    await requireDailyToken(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'codes');
    if (action === 'geocode') {
      const query = String(body.query || '').trim().slice(0, 200);
      if (query.length < 3) return jsonResponseFor(req, { result: null });
      return jsonResponseFor(req, { result: await geocodeAddress(query) });
    }
    if (action === 'notify') {
      return jsonResponseFor(req, { result: await notifyUsage(body) });
    }

    const ids = Array.isArray(body.coupon_ids)
      ? body.coupon_ids.map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0)
      : [];

    let query = adminClient()
      .from('coupon')
      .select('id,company,code,status,auto_download_details,last_scraped,last_detail_view,last_company_view,last_code_view')
      .eq('status', 'פעיל')
      .eq('auto_download_details', 'Multipass')
      .order('id');
    if (ids.length > 0) query = query.in('id', ids);

    const { data, error } = await query;
    if (error) throw error;

    const eligible = (data || []).filter((coupon) => shouldUpdateCoupon(coupon as CouponRow));
    const coupons = [];
    for (const coupon of eligible as CouponRow[]) {
      coupons.push({
        id: coupon.id,
        company: coupon.company,
        code: await decryptCouponValue(coupon.code),
      });
    }

    return jsonResponseFor(req, { coupons, selected: coupons.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponseFor(req, { error: message }, status);
  }
});
