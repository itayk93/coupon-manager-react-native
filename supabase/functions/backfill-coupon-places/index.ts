import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_FIND_PLACE_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const normalize = (value: string) => value.trim().toLocaleLowerCase('he-IL').replace(/["'׳״.,()-]/g, ' ').replace(/\s+/g, ' ');

type LegacyTransaction = {
  location: string | null;
  usage_amount: number | null;
};

type PlaceResult = {
  query: string;
  status: 'resolved' | 'unresolved' | 'failed';
  address?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function searchPlace(query: string, apiKey: string) {
  const response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.id',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'he',
      regionCode: 'IL',
      maxResultCount: 1,
    }),
  });
  if (response.ok) {
    const data = await response.json();
    if (data?.places?.[0]) return data.places[0];
  }

  const legacyUrl = new URL(GOOGLE_FIND_PLACE_URL);
  legacyUrl.searchParams.set('input', query);
  legacyUrl.searchParams.set('inputtype', 'textquery');
  legacyUrl.searchParams.set('fields', 'name,formatted_address,geometry,place_id');
  legacyUrl.searchParams.set('language', 'iw');
  legacyUrl.searchParams.set('locationbias', 'circle:50000@31.8,34.9');
  legacyUrl.searchParams.set('key', apiKey);
  const legacyResponse = await fetch(legacyUrl, { redirect: 'error' });
  if (legacyResponse.ok) {
    const legacyData = await legacyResponse.json();
    const candidate = legacyData?.candidates?.[0];
    if (candidate?.geometry?.location) {
      return {
        displayName: { text: candidate.name || query },
        formattedAddress: candidate.formatted_address,
        location: {
          latitude: candidate.geometry.location.lat,
          longitude: candidate.geometry.location.lng,
        },
        id: candidate.place_id,
      };
    }
  }

  const geocodeUrl = new URL(GOOGLE_GEOCODE_URL);
  geocodeUrl.searchParams.set('address', `${query}, ישראל`);
  geocodeUrl.searchParams.set('region', 'il');
  geocodeUrl.searchParams.set('language', 'iw');
  geocodeUrl.searchParams.set('key', apiKey);
  const geocodeResponse = await fetch(geocodeUrl, { redirect: 'error' });
  if (!geocodeResponse.ok) throw new Error(`Google APIs HTTP ${response.status}/${legacyResponse.status}/${geocodeResponse.status}`);
  const geocodeData = await geocodeResponse.json();
  const geocoded = geocodeData?.results?.[0];
  if (!geocoded?.geometry?.location) return null;
  return {
    displayName: { text: query },
    formattedAddress: geocoded.formatted_address,
    location: {
      latitude: geocoded.geometry.location.lat,
      longitude: geocoded.geometry.location.lng,
    },
    id: geocoded.place_id,
  };
}

Deno.serve(async (req: Request) => {
  const expectedToken = Deno.env.get('LOCATION_BACKFILL_TOKEN');
  const suppliedToken = req.headers.get('x-backfill-token');
  if (!expectedToken || !suppliedToken || suppliedToken !== expectedToken) {
    return json({ error: 'FORBIDDEN' }, 403);
  }
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) return json({ error: 'Google Maps is not configured' }, 503);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await db
    .from('coupon_transaction')
    .select('location,usage_amount')
    .gt('usage_amount', 0)
    .not('location', 'is', null);
  if (error) return json({ error: error.message }, 500);

  const uniquePlaces = new Map<string, string>();
  ((data || []) as LegacyTransaction[]).forEach((row) => {
    const location = row.location?.trim();
    if (location) uniquePlaces.set(normalize(location), location);
  });

  const results: PlaceResult[] = [];
  const places = Array.from(uniquePlaces.entries());
  for (let offset = 0; offset < places.length; offset += 5) {
    const batch = places.slice(offset, offset + 5);
    const batchResults = await Promise.all(batch.map(async ([normalizedName, query]): Promise<PlaceResult> => {
      try {
        const place = await searchPlace(query, apiKey);
        const location = place?.location;
        const address = String(place?.formattedAddress || '').trim();
        if (!place || !location || !address || !address.includes('ישראל')) {
          return { query, status: 'unresolved' };
        }
        const { error: upsertError } = await db.from('coupon_places').upsert({
          normalized_name: normalizedName,
          place_name: String(place.displayName?.text || query).trim(),
          place_address: address,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          google_place_id: place.id || null,
          source: 'google_places_backfill',
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'normalized_name' });
        if (upsertError) throw upsertError;
        return { query, status: 'resolved', address };
      } catch {
        return { query, status: 'failed' };
      }
    }));
    results.push(...batchResults);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return json({
    total: results.length,
    resolved: results.filter((item) => item.status === 'resolved').length,
    unresolved: results.filter((item) => item.status === 'unresolved').map((item) => item.query),
    failed: results.filter((item) => item.status === 'failed').map((item) => item.query),
  });
});
