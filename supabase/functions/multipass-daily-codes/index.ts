import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptCouponValue } from '../_shared/encryption.ts';
import { corsHeadersFor, jsonResponseFor } from '../_shared/cors.ts';
import { sendPushToUser } from '../_shared/push.ts';

const TOKEN_SHA256 = '1a0a0f98c12e7e45bd4876fbc8c399861ee4fdbb17c3350bd47a45f15d3d1303';
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

type CouponRow = {
  id: number;
  user_id: number;
  company: string;
  code: string;
  value: number;
  used_value: number;
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
  const cronToken = req.headers.get('x-cron-token') || '';
  const expectedCronToken = Deno.env.get('MULTIPASS_CRON_TOKEN') || '';
  let mismatch = cronToken.length ^ expectedCronToken.length;
  for (let index = 0; index < Math.max(cronToken.length, expectedCronToken.length); index += 1) {
    mismatch |= (cronToken.charCodeAt(index) || 0) ^ (expectedCronToken.charCodeAt(index) || 0);
  }
  const cronMatches = cronToken.length > 0 && mismatch === 0;
  if (!cronMatches && (!token || await sha256(token) !== TOKEN_SHA256)) throw new Error('UNAUTHENTICATED');
}

function normalizeCard(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function parseAmount(value: unknown) {
  const amount = Number.parseFloat(String(value ?? '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(amount) ? amount : 0;
}

function parseTransactionDate(value: unknown): string | null {
  const match = String(value || '').match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [, day, month, year, hour = '0', minute = '0'] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 2, Number(minute))).toISOString();
}

type ScrapeTransaction = {
  transaction_date?: string;
  location?: string;
  recharge_amount?: string | number;
  usage_amount?: string | number;
  reference_number?: string;
};

type ScrapeResult = { card_number?: string; transactions?: ScrapeTransaction[] };

async function processScrapeResults(body: Record<string, unknown>) {
  const results = Array.isArray(body.results) ? body.results as ScrapeResult[] : [];
  const rawFailures = Array.isArray(body.failures) ? body.failures as Array<Record<string, unknown>> : [];
  if (results.length > 100 || rawFailures.length > 100) throw new Error('INVALID_INPUT');

  const db = adminClient();
  const { data: couponData, error: couponError } = await db.from('coupon')
    .select('id,user_id,company,code,value,used_value,status,auto_download_details,last_scraped,last_detail_view,last_company_view,last_code_view')
    .eq('auto_download_details', 'Multipass');
  if (couponError) throw couponError;

  const couponsByCard = new Map<string, CouponRow>();
  for (const coupon of (couponData || []) as CouponRow[]) {
    const card = normalizeCard(await decryptCouponValue(coupon.code));
    if (card) couponsByCard.set(card, coupon);
  }

  const items: Array<Record<string, unknown>> = [];
  const failures = rawFailures.map((failure) => {
    const coupon = couponsByCard.get(normalizeCard(failure.card_number));
    return `${coupon?.company || 'קופון לא מזוהה'}: ${String(failure.error || 'scraper failed')}`;
  });
  let processed = 0;
  const now = new Date().toISOString();

  for (const cardResult of results) {
    const coupon = couponsByCard.get(normalizeCard(cardResult.card_number));
    if (!coupon) {
      failures.push('התקבלה תוצאה לכרטיס שלא נמצא במערכת');
      continue;
    }

    const { data: existingRows, error: existingError } = await db.from('coupon_transaction')
      .select('reference_number')
      .eq('coupon_id', coupon.id)
      .not('reference_number', 'is', null);
    if (existingError) throw existingError;
    const existingRefs = new Set((existingRows || []).map((row) => String(row.reference_number)));
    const newTransactions = [];
    let newestUsage: ScrapeTransaction | null = null;

    for (const transaction of Array.isArray(cardResult.transactions) ? cardResult.transactions : []) {
      const reference = String(transaction.reference_number || '').trim() || null;
      if (reference && existingRefs.has(reference)) continue;
      const usageAmount = parseAmount(transaction.usage_amount);
      const rechargeAmount = parseAmount(transaction.recharge_amount);
      newTransactions.push({
        coupon_id: coupon.id,
        transaction_date: parseTransactionDate(transaction.transaction_date),
        location: String(transaction.location || '').trim() || null,
        recharge_amount: rechargeAmount || null,
        usage_amount: usageAmount || null,
        reference_number: reference,
        source: 'Multipass',
      });
      if (reference) existingRefs.add(reference);
      if (usageAmount > 0) newestUsage = transaction;
    }
    if (newTransactions.length > 0) {
      const { error } = await db.from('coupon_transaction').insert(newTransactions);
      if (error) throw error;
    }

    const { data: allTransactions, error: totalsError } = await db.from('coupon_transaction')
      .select('usage_amount,recharge_amount')
      .eq('coupon_id', coupon.id)
      .eq('source', 'Multipass');
    if (totalsError) throw totalsError;
    const usedTotal = (allTransactions || []).reduce((sum, tx) => sum + Number(tx.usage_amount || 0), 0);
    const rechargeTotal = (allTransactions || []).reduce((sum, tx) => sum + Number(tx.recharge_amount || 0), 0);
    const newValue = rechargeTotal > 0 ? rechargeTotal : Number(coupon.value || 0);
    const oldUsed = Number(coupon.used_value || 0);
    const newUsed = Math.max(0, Math.min(newValue, usedTotal));
    const delta = Math.max(0, newUsed - oldUsed);
    const status = newUsed >= newValue ? 'נוצל' : 'פעיל';
    const { error: updateError } = await db.from('coupon').update({
      value: newValue,
      used_value: newUsed,
      status,
      last_scraped: now,
    }).eq('id', coupon.id);
    if (updateError) throw updateError;
    processed += 1;

    if (delta > 0) {
      const location = String(newestUsage?.location || '').trim();
      const place = location ? await geocodeAddress(location).catch(() => null) : null;
      const { error: usageError } = await db.from('coupon_usage').insert({
        coupon_id: coupon.id,
        used_amount: delta,
        action: 'Multipass',
        details: 'עדכון אוטומטי via Multipass CI flow',
        timestamp: now,
        place_name: place?.place_name || location || null,
        place_address: place?.place_address || null,
        latitude: place?.latitude ?? null,
        longitude: place?.longitude ?? null,
      });
      if (usageError) throw usageError;
      await notifyUsage({ user_id: coupon.user_id, coupon_id: coupon.id, company: coupon.company, delta }).catch(() => null);
      items.push({
        coupon_id: coupon.id,
        company: coupon.company,
        old_usage: oldUsed,
        new_usage: newUsed,
        delta,
        value: newValue,
        remaining_value: Math.max(0, newValue - newUsed),
        place_name: place?.place_name || location || null,
        place_address: place?.place_address || null,
      });
    }
  }

  return {
    user_id: Number((couponData || [])[0]?.user_id || 1),
    selected: results.length + rawFailures.length,
    scanned: results.length,
    updated: items.length,
    processed,
    failed: failures.length,
    skipped: 0,
    no_change: items.length === 0,
    items,
    failures,
    run_date: new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
  };
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
  const { data: coupon } = couponId > 0
    ? await db.from('coupon').select('public_id').eq('id', couponId).eq('user_id', userId).maybeSingle()
    : { data: null };
  const couponRouteId = coupon?.public_id || (couponId > 0 ? String(couponId) : null);
  await db.from('notifications').insert({
    user_id: userId,
    message,
    link: couponRouteId ? `/coupons/${couponRouteId}` : '/notifications',
    shown: false,
    viewed: false,
    hide_from_view: false,
  });

  const push = await sendPushToUser(db, userId, {
    title: 'קופון מאסטר',
    body: message,
    url: couponRouteId ? `/coupons/${couponRouteId}` : '/notifications',
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
    if (action === 'process_results') {
      return jsonResponseFor(req, { result: await processScrapeResults(body) });
    }

    const ids = Array.isArray(body.coupon_ids)
      ? body.coupon_ids.map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0)
      : [];

    let query = adminClient()
      .from('coupon')
      .select('id,user_id,company,code,value,used_value,status,auto_download_details,last_scraped,last_detail_view,last_company_view,last_code_view')
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
