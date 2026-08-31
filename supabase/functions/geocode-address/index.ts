import { corsHeadersFor, jsonResponseFor } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isCountryLevelResult } from '../_shared/geocodeQuality.ts';

const GOOGLE_FIND_PLACE_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const normalize = (value: string) => value.trim().toLocaleLowerCase('he-IL').replace(/["'׳״.,()-]/g, ' ').replace(/\s+/g, ' ');
const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

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
  // Every query here is a shop name with ', ישראל' glued on. An unrecognised
  // name geocodes to the country itself, and that answer is worse than none:
  // it puts a pin in the Negev and stretches the usage map to reach it.
  if (isCountryLevelResult(candidate)) {
    diagnostics.push('geocoding:country_level_rejected');
    return null;
  }
  return { address: candidate.address, latitude: candidate.latitude, longitude: candidate.longitude };
}

async function searchPlace(query: string, apiKey: string, diagnostics: string[]) {
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
  if (isCountryLevelResult({
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    address: place.formattedAddress,
  })) {
    diagnostics.push('places_new:country_level_rejected');
    return null;
  }
  return {
    placeName: String(place.displayName?.text || query).trim(),
    address: String(place.formattedAddress || '').trim(),
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    placeId: place.id || null,
  };
}

function addressQueries(query: string) {
  const withoutBrand = query
    .replace(/\bגוד\s*פארם\b/giu, '')
    .replace(/\bgood\s*pharm\b/giu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...new Set([`${query}, ישראל`, `${withoutBrand}, ישראל`].filter((value) => value.length > 8))];
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
    const { data: localPlace } = await db.from('coupon_places')
      .select('place_name,place_address,latitude,longitude,google_place_id,source')
      .eq('normalized_name', normalizedName).maybeSingle();
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

    // Geocoding also resolves many local business names, without requiring a saved address.
    let liveGeocode = null;
    for (const addressQuery of addressQueries(query)) {
      liveGeocode = await geocodeAddress(addressQuery, apiKey, diagnostics);
      if (liveGeocode) break;
    }
    if (liveGeocode) {
      await db.from('coupon_places').upsert({
        normalized_name: normalizedName,
        place_name: localPlace?.place_name || query,
        place_address: liveGeocode.address,
        latitude: liveGeocode.latitude,
        longitude: liveGeocode.longitude,
        google_place_id: localPlace?.google_place_id || null,
        source: 'google_geocoding',
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'normalized_name' });
      return jsonResponseFor(req, { result: {
        placeName: localPlace?.place_name || query,
        address: liveGeocode.address,
        latitude: liveGeocode.latitude,
        longitude: liveGeocode.longitude,
        source: 'google_geocoding',
      } });
    }

    if (localPlace?.place_address) {
      const geocoded = await geocodeAddress(localPlace.place_address, apiKey, diagnostics);
      if (geocoded) {
        await db.from('coupon_places').upsert({
          normalized_name: normalizedName,
          place_name: localPlace.place_name || query,
          place_address: geocoded.address,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          google_place_id: localPlace.google_place_id || null,
          source: 'google_geocoding',
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'normalized_name' });
        return jsonResponseFor(req, { result: {
          placeName: localPlace.place_name || query,
          address: geocoded.address,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          source: 'google_geocoding',
        } });
      }
    }

    const livePlace = await searchPlace(query, apiKey, diagnostics);
    if (livePlace) {
      await db.from('coupon_places').upsert({
        normalized_name: normalizedName,
        place_name: livePlace.placeName,
        place_address: livePlace.address,
        latitude: livePlace.latitude,
        longitude: livePlace.longitude,
        google_place_id: livePlace.placeId,
        source: 'google_places_new',
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'normalized_name' });
      return jsonResponseFor(req, { result: {
        placeName: livePlace.placeName,
        address: livePlace.address,
        latitude: livePlace.latitude,
        longitude: livePlace.longitude,
        source: 'google_places_new',
      } });
    }

    const url = new URL(GOOGLE_FIND_PLACE_URL);
    url.searchParams.set('input', localPlace?.place_address ? `${query}, ${localPlace.place_address}` : query);
    url.searchParams.set('inputtype', 'textquery');
    url.searchParams.set('fields', 'name,formatted_address,geometry,place_id');
    url.searchParams.set('language', 'iw');
    url.searchParams.set('locationbias', 'circle:50000@31.8,34.9');
    url.searchParams.set('key', apiKey);

    const googleResponse = await fetch(url, { redirect: 'error' });
    if (!googleResponse.ok) throw new Error(`Google Places request failed: ${googleResponse.status}`);
    const googleData = await googleResponse.json();
    const candidate = googleData?.candidates?.[0];
    const location = candidate?.geometry?.location;

    diagnostics.push(`places_legacy:${googleData?.status || 'UNKNOWN'}`);
    const countryLevel = candidate && location
      ? isCountryLevelResult({
          latitude: Number(location.lat),
          longitude: Number(location.lng),
          address: candidate.formatted_address,
        })
      : false;
    if (countryLevel) diagnostics.push('places_legacy:country_level_rejected');
    if (googleData?.status !== 'OK' || !candidate || !location || countryLevel) {
      if (localPlace?.place_address) {
        return jsonResponseFor(req, { result: {
          placeName: localPlace.place_name || query,
          address: localPlace.place_address,
          latitude: null,
          longitude: null,
          source: 'local_database',
        }, diagnostics });
      }
      return jsonResponseFor(req, {
        result: null,
        errorCode: googleData?.status || 'PLACE_NOT_FOUND',
        diagnostics,
      });
    }

    await db.from('coupon_places').upsert({
      normalized_name: normalizedName,
      place_name: String(candidate.name || query).trim(),
      place_address: String(candidate.formatted_address || '').trim(),
      latitude: Number(location.lat),
      longitude: Number(location.lng),
      google_place_id: candidate.place_id || null,
      source: 'google_places',
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'normalized_name' });

    return jsonResponseFor(req, {
      result: {
        placeName: String(candidate.name || query).trim(),
        address: String(candidate.formatted_address || '').trim(),
        latitude: Number(location.lat),
        longitude: Number(location.lng),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Geocoding failed';
    const status = message === 'UNAUTHENTICATED' || message === 'FORBIDDEN' ? 401 : 500;
    return jsonResponseFor(req, { error: message }, status);
  }
});
