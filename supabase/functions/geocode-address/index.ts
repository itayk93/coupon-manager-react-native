import { corsHeadersFor, jsonResponseFor } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { geocodeConfidence, isCountryLevelResult, placeMatchesQuery } from '../_shared/geocodeQuality.ts';

const GOOGLE_FIND_PLACE_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const normalize = (value: string) => value.trim().toLocaleLowerCase('he-IL').replace(/["'׳״.,()-]/g, ' ').replace(/\s+/g, ' ');
/** Written before results were graded; see the cache read below. */
const LEGACY_GEOCODING_SOURCE = 'google_geocoding';
const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

type ResolvedPlace = {
  placeName: string;
  address: string;
  latitude: number;
  longitude: number;
  placeId: string | null;
  source: 'google_places_new' | 'google_geocoding_exact' | 'google_places';
};

/**
 * Resolution order matters. Every query is a business name, so the API built
 * for business names goes first; the street-address geocoder is the fallback,
 * and only its confident answers are kept. Anything cached here is served on
 * every later lookup of the same name, so a weak guess must never be written.
 */

async function searchPlace(query: string, apiKey: string, diagnostics: string[]): Promise<ResolvedPlace | null> {
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
  if (!response.ok) {
    diagnostics.push(`places_new:http_${response.status}`);
    return null;
  }
  const data = await response.json();
  if (data?.error?.status) diagnostics.push(`places_new:${data.error.status}`);
  else diagnostics.push(`places_new:${data?.places?.length ? 'OK' : 'ZERO_RESULTS'}`);
  const place = data?.places?.[0];
  const location = place?.location;
  if (!place || !location) return null;
  const candidate = {
    placeName: String(place.displayName?.text || '').trim(),
    address: String(place.formattedAddress || '').trim(),
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  };
  if (isCountryLevelResult(candidate)) {
    diagnostics.push('places_new:country_level_rejected');
    return null;
  }
  // Text Search always answers with *some* business. Make sure it is ours.
  if (!placeMatchesQuery(query, [candidate.placeName, candidate.address])) {
    diagnostics.push('places_new:unrelated_rejected');
    return null;
  }
  return { ...candidate, placeName: candidate.placeName || query, placeId: place.id || null, source: 'google_places_new' };
}

async function geocodeAddress(address: string, apiKey: string, diagnostics: string[]) {
  const url = new URL(GOOGLE_GEOCODE_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'il');
  url.searchParams.set('language', 'iw');
  url.searchParams.set('key', apiKey);
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) {
    diagnostics.push(`geocoding:http_${response.status}`);
    return null;
  }
  const data = await response.json();
  diagnostics.push(`geocoding:${data?.status || 'UNKNOWN'}`);
  const result = data?.results?.[0];
  const location = result?.geometry?.location;
  if (data?.status !== 'OK' || !result || !location) return null;
  const candidate = {
    address: String(result.formatted_address || address).trim(),
    latitude: Number(location.lat),
    longitude: Number(location.lng),
    types: Array.isArray(result.types) ? result.types : null,
  };
  if (isCountryLevelResult(candidate)) {
    diagnostics.push('geocoding:country_level_rejected');
    return null;
  }
  const confidence = geocodeConfidence(result);
  diagnostics.push(`geocoding:${confidence}`);
  return { address: candidate.address, latitude: candidate.latitude, longitude: candidate.longitude, confidence };
}

async function findPlaceLegacy(input: string, apiKey: string, diagnostics: string[]): Promise<ResolvedPlace | null> {
  const url = new URL(GOOGLE_FIND_PLACE_URL);
  url.searchParams.set('input', input);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'name,formatted_address,geometry,place_id');
  url.searchParams.set('language', 'iw');
  url.searchParams.set('locationbias', 'circle:50000@31.8,34.9');
  url.searchParams.set('key', apiKey);

  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw new Error(`Google Places request failed: ${response.status}`);
  const data = await response.json();
  diagnostics.push(`places_legacy:${data?.status || 'UNKNOWN'}`);
  const candidate = data?.candidates?.[0];
  const location = candidate?.geometry?.location;
  if (data?.status !== 'OK' || !candidate || !location) return null;
  const resolved = {
    placeName: String(candidate.name || '').trim(),
    address: String(candidate.formatted_address || '').trim(),
    latitude: Number(location.lat),
    longitude: Number(location.lng),
  };
  if (isCountryLevelResult(resolved)) {
    diagnostics.push('places_legacy:country_level_rejected');
    return null;
  }
  return { ...resolved, placeName: resolved.placeName || input, placeId: candidate.place_id || null, source: 'google_places' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) });

  try {
    await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const query = String(body?.query || '').trim().slice(0, 200);
    if (query.length < 3) return jsonResponseFor(req, { result: null });

    const normalizedName = normalize(query);
    const diagnostics: string[] = [];
    const db = admin();
    const { data: cachedPlace } = await db.from('coupon_places')
      .select('place_name,place_address,latitude,longitude,google_place_id,source')
      .eq('normalized_name', normalizedName).maybeSingle();
    // Rows written by the old geocoder-first flow are partial matches at best —
    // three of them share "המלך ג'ורג' 25", fourteen say only "ישראל". They are
    // not served and not used as a seed; the next lookup overwrites them.
    const localPlace = cachedPlace?.source === LEGACY_GEOCODING_SOURCE ? null : cachedPlace;
    if (localPlace?.source !== 'verified_business_directory' && localPlace?.place_address && localPlace.latitude !== null && localPlace.longitude !== null) {
      return jsonResponseFor(req, { result: {
        placeName: localPlace.place_name,
        address: localPlace.place_address,
        latitude: localPlace.latitude,
        longitude: localPlace.longitude,
        source: 'local_database',
      } });
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) return jsonResponseFor(req, { error: 'Google Maps is not configured' }, 503);

    const remember = async (place: ResolvedPlace) => {
      await db.from('coupon_places').upsert({
        normalized_name: normalizedName,
        place_name: place.placeName,
        place_address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        google_place_id: place.placeId ?? localPlace?.google_place_id ?? null,
        source: place.source,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'normalized_name' });
      return jsonResponseFor(req, { result: {
        placeName: place.placeName,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        source: place.source,
      } });
    };

    // 1. The business itself, by name.
    const livePlace = await searchPlace(query, apiKey, diagnostics);
    if (livePlace) return remember(livePlace);

    // 2. The address geocoder. A confident answer is kept; a partial match is
    //    only good enough to show once, and is never written to the cache.
    let weakGeocode: Awaited<ReturnType<typeof geocodeAddress>> = null;
    const geocoded = await geocodeAddress(`${query}, ישראל`, apiKey, diagnostics);
    if (geocoded?.confidence === 'strong') {
      return remember({
        placeName: localPlace?.place_name || query,
        address: geocoded.address,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        placeId: null,
        source: 'google_geocoding_exact',
      });
    }
    weakGeocode = geocoded;

    // 3. A saved address with no coordinates yet — geocode the address itself.
    if (localPlace?.place_address) {
      const fromSaved = await geocodeAddress(localPlace.place_address, apiKey, diagnostics);
      if (fromSaved?.confidence === 'strong') {
        return remember({
          placeName: localPlace.place_name || query,
          address: fromSaved.address,
          latitude: fromSaved.latitude,
          longitude: fromSaved.longitude,
          placeId: null,
          source: 'google_geocoding_exact',
        });
      }
    }

    // 4. The legacy place finder, last.
    const legacyPlace = await findPlaceLegacy(
      localPlace?.place_address ? `${query}, ${localPlace.place_address}` : query,
      apiKey,
      diagnostics,
    );
    if (legacyPlace) return remember(legacyPlace);

    // Nothing confident. Show the best guess for this screen only.
    if (weakGeocode) {
      return jsonResponseFor(req, { result: {
        placeName: localPlace?.place_name || query,
        address: weakGeocode.address,
        latitude: weakGeocode.latitude,
        longitude: weakGeocode.longitude,
        source: 'google_geocoding_partial',
      }, diagnostics });
    }
    if (localPlace?.place_address) {
      return jsonResponseFor(req, { result: {
        placeName: localPlace.place_name || query,
        address: localPlace.place_address,
        latitude: null,
        longitude: null,
        source: 'local_database',
      }, diagnostics });
    }
    return jsonResponseFor(req, { result: null, errorCode: 'PLACE_NOT_FOUND', diagnostics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Geocoding failed';
    const status = message === 'UNAUTHENTICATED' || message === 'FORBIDDEN' ? 401 : 500;
    return jsonResponseFor(req, { error: message }, status);
  }
});
