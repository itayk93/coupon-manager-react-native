import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { decryptCouponValue } from '../_shared/encryption.ts';
import { hashKey, parseQuery, QueryError } from './query.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type', ...(status === 429 ? { 'Retry-After': '60' } : {}) },
});
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'GET') return json({ error: 'Read-only API. Use GET.' }, 405);
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('apikey') ?? url.searchParams.get('key') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!key || !/^cm_instinct_[a-f0-9]{64}$/.test(key)) return json({ error: 'Invalid or missing API key' }, 401);
    const segments = url.pathname.split('/').filter(Boolean);
    const resource = segments.slice(segments.lastIndexOf('instinct-api') + 1);
    if (resource.length > 1) return json({ error: 'Not found' }, 404);
    const table = resource[0] || 'schema';
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await client.rpc('instinct_read', { p_hash: await hashKey(key), p_table: table, ...parseQuery(url.searchParams) });
    if (error) {
      if (error.code === '28000') return json({ error: 'Invalid, expired or revoked API key' }, 401);
      if (error.message === 'UNKNOWN_TABLE') return json({ error: 'Unknown table. See /schema.' }, 404);
      if (error.code?.startsWith('22')) return json({ error: 'Invalid column, filter, ordering or value. See /schema.' }, 400);
      console.error('instinct_read failed', error.code);
      return json({ error: 'Query failed' }, 500);
    }
    if (data?.error === 'RATE_LIMITED') return json({ error: 'Rate limit: 120 requests per minute' }, 429);
    if (table === 'coupon' && Array.isArray(data?.rows)) {
      const fields = ['code','description','cvv','card_exp','buyme_coupon_url','strauss_coupon_url','xgiftcard_coupon_url','xtra_coupon_url'];
      await Promise.all(data.rows.map(async (row: Record<string, unknown>) => {
        await Promise.all(fields.map(async field => {
          const value = row[field];
          if (typeof value === 'string' && value) row[field] = await decryptCouponValue(value);
        }));
      }));
    }
    return json(data);
  } catch (error) {
    if (error instanceof QueryError) return json({ error: error.message }, 400);
    console.error('instinct-api unexpected failure');
    return json({ error: 'Internal error' }, 500);
  }
});
