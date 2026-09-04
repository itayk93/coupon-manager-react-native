import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser } from '../_shared/auth.ts';
import { corsHeadersFor, jsonResponseFor } from '../_shared/cors.ts';
import { decryptCouponValue } from '../_shared/encryption.ts';
import { safeFetch } from '../_shared/ssrf.ts';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MODEL = 'gpt-5-mini';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAINTAINER_USER_ID = 1;

const dbClient = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function normalizeQuery(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('he-IL')
    .replace(/["'׳״.,()\-_/\\|:;!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function responseText(payload: Record<string, unknown>): string {
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output as Array<Record<string, unknown>>) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content as Array<Record<string, unknown>>) {
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  return '';
}

function webSources(payload: Record<string, unknown>): string[] {
  const sources = new Set<string>();
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output as Array<Record<string, unknown>>) {
    const action = item.action as Record<string, unknown> | undefined;
    if (item.type === 'web_search_call' && Array.isArray(action?.sources)) {
      for (const source of action.sources as Array<Record<string, unknown>>) {
        if (typeof source.url === 'string' && source.url.startsWith('https://')) sources.add(source.url);
      }
    }
  }
  return [...sources].slice(0, 12);
}

function safeSourceUrl(value: unknown, sources: string[]): string {
  const url = String(value || '');
  return sources.includes(url) ? url : '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeadersFor(req) });
  try {
    const user = await requireUser(req);
    if (user.id !== MAINTAINER_USER_ID) throw new Error('FORBIDDEN');

    const body = await req.json();
    const directoryMode = body?.mode === 'directory';
    const couponId = Number(body?.couponId);
    const query = directoryMode ? `coupon:${couponId}` : normalizeQuery(body?.query);
    if (directoryMode) {
      if (!Number.isSafeInteger(couponId) || couponId <= 0) throw new Error('INVALID_INPUT');
    } else if (query.length < 2 || !/[\p{L}]/u.test(query)) {
      throw new Error('INVALID_INPUT');
    }

    const db = dbClient();
    const { data: cached } = await db.from('coupon_merchant_search_cache')
      .select('result,expires_at')
      .eq('user_id', MAINTAINER_USER_ID)
      .eq('normalized_query', query)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (cached?.result) return jsonResponseFor(req, { data: { ...cached.result, cached: true } });

    if (directoryMode) {
      const { data: couponRow, error: couponError } = await db.from('coupon')
        .select('id,company,description,source,status,deleted_at,value,used_value')
        .eq('id', couponId)
        .eq('user_id', MAINTAINER_USER_ID)
        .maybeSingle();
      if (couponError) throw couponError;
      if (!couponRow || couponRow.deleted_at) throw new Error('NOT_FOUND');

      const coupon = {
        id: couponRow.id,
        company: couponRow.company,
        description: couponRow.description ? await decryptCouponValue(couponRow.description) : null,
        source: couponRow.source || null,
      };
      const apiKey = Deno.env.get('OPENAI_API_KEY_V2') || Deno.env.get('OPENAI_API_KEY');
      if (!apiKey) throw new Error('OPENAI_NOT_CONFIGURED');
      const directorySchema = {
        type: 'object',
        additionalProperties: false,
        properties: {
          provider: { type: 'string' },
          merchants: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                reason: { type: 'string' },
                source_url: { type: 'string' },
              },
              required: ['name', 'reason', 'source_url'],
            },
          },
        },
        required: ['provider', 'merchants'],
      };
      const aiResponse = await safeFetch(OPENAI_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          tools: [{ type: 'web_search', search_context_size: 'high' }],
          tool_choice: 'required',
          max_tool_calls: 8,
          max_output_tokens: 6000,
          store: false,
          input: `מצא אילו חנויות ובתי עסק מכבדים כיום את הקופון הבא: ${JSON.stringify(coupon)}.
השתמש רק בעמודים רשמיים ועדכניים של מנפיק הקופון. החזר רשימה שימושית של שמות החנויות שמופיעות במקור, בלי לנחש ובלי להוסיף חנויות שנמכרות כקופון נפרד. לכל חנות צרף URL מדויק של המקור הרשמי שמוכיח שהיא מכובדת. אם אין רשימה מאומתת, החזר merchants ריק.`,
          text: { format: { type: 'json_schema', name: 'coupon_merchant_directory', strict: true, schema: directorySchema } },
          include: ['web_search_call.action.sources'],
        }),
      });
      if (!aiResponse.ok) {
        console.error('[search-coupon-merchants] directory OpenAI status:', aiResponse.status);
        throw new Error('SEARCH_UNAVAILABLE');
      }
      const payload = await aiResponse.json() as Record<string, unknown>;
      const parsed = JSON.parse(responseText(payload) || '{"provider":"","merchants":[]}');
      const sources = webSources(payload);
      const seen = new Set<string>();
      const merchants = (Array.isArray(parsed.merchants) ? parsed.merchants : [])
        .map((merchant: Record<string, unknown>) => ({
          name: String(merchant.name || '').trim().slice(0, 100),
          reason: String(merchant.reason || '').trim().slice(0, 220),
          sourceUrl: safeSourceUrl(merchant.source_url, sources),
        }))
        .filter((merchant: { name: string; sourceUrl: string }) => {
          const key = normalizeQuery(merchant.name);
          if (!key || !merchant.sourceUrl || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 80);
      const result = {
        couponId,
        provider: String(parsed.provider || coupon.company).trim().slice(0, 100),
        merchants,
        sources,
        checkedAt: new Date().toISOString(),
        cached: false,
      };
      await db.from('coupon_merchant_search_cache').upsert({
        user_id: MAINTAINER_USER_ID,
        normalized_query: query,
        result,
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,normalized_query' });
      return jsonResponseFor(req, { data: result });
    }

    const { data: rows, error } = await db.from('coupon')
      .select('id,public_id,company,description,source,value,used_value,expiration')
      .eq('user_id', MAINTAINER_USER_ID)
      .eq('status', 'פעיל')
      .is('deleted_at', null)
      .gt('value', 0);
    if (error) throw error;

    const coupons = await Promise.all((rows || [])
      .filter((coupon) => Number(coupon.value) - Number(coupon.used_value) > 0)
      .map(async (coupon) => ({
        id: coupon.id,
        company: coupon.company,
        description: coupon.description ? await decryptCouponValue(coupon.description) : null,
        source: coupon.source || null,
      })));

    const directIds = coupons
      .filter((coupon) => normalizeQuery(coupon.company).includes(query) || query.includes(normalizeQuery(coupon.company)))
      .map((coupon) => coupon.id);
    const candidates = coupons.filter((coupon) => !directIds.includes(coupon.id));
    const apiKey = Deno.env.get('OPENAI_API_KEY_V2') || Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_NOT_CONFIGURED');

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        matches: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              coupon_id: { type: 'integer' },
              provider: { type: 'string' },
              reason: { type: 'string' },
              confidence: { type: 'string', enum: ['high', 'medium'] },
            },
            required: ['coupon_id', 'provider', 'reason', 'confidence'],
          },
        },
      },
      required: ['matches'],
    };

    const aiResponse = await safeFetch(OPENAI_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        tools: [{ type: 'web_search', search_context_size: 'medium' }],
        tool_choice: 'required',
        max_tool_calls: 6,
        store: false,
        input: `חפש באינטרנט אם החנות "${query}" מכובדת באחד מהקופונים הכלליים הבאים.
הסתמך על מקור רשמי ועדכני של מנפיק הקופון. אל תנחש. אל תסמן התאמה רק כי המנפיק מוכר קופון נפרד לחנות; צריך להוכיח שהכרטיס המתואר ברשומה עצמה מכבד אותה.
החזר רק התאמות ברמת ודאות high או medium. אם אין הוכחה, החזר מערך ריק.
קופונים: ${JSON.stringify(candidates)}`,
        text: { format: { type: 'json_schema', name: 'coupon_merchant_matches', strict: true, schema } },
        include: ['web_search_call.action.sources'],
      }),
    });
    if (!aiResponse.ok) {
      console.error('[search-coupon-merchants] OpenAI status:', aiResponse.status);
      throw new Error('SEARCH_UNAVAILABLE');
    }
    const payload = await aiResponse.json() as Record<string, unknown>;
    const parsed = JSON.parse(responseText(payload) || '{"matches":[]}');
    const candidateIds = new Set(candidates.map((coupon) => coupon.id));
    const aiMatches = (Array.isArray(parsed.matches) ? parsed.matches : [])
      .filter((match: Record<string, unknown>) => candidateIds.has(Number(match.coupon_id)))
      .map((match: Record<string, unknown>) => ({
        couponId: Number(match.coupon_id),
        provider: String(match.provider || ''),
        reason: String(match.reason || '').slice(0, 220),
        confidence: match.confidence === 'high' ? 'high' : 'medium',
      }));
    const result = {
      query,
      directCouponIds: directIds,
      matches: aiMatches,
      sources: webSources(payload),
      checkedAt: new Date().toISOString(),
      cached: false,
    };

    await db.from('coupon_merchant_search_cache').upsert({
      user_id: MAINTAINER_USER_ID,
      normalized_query: query,
      result,
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,normalized_query' });

    return jsonResponseFor(req, { data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'UNAUTHENTICATED') return jsonResponseFor(req, { error: message }, 401);
    if (message === 'FORBIDDEN') return jsonResponseFor(req, { error: message }, 403);
    if (message === 'INVALID_INPUT') return jsonResponseFor(req, { error: message }, 400);
    if (message === 'NOT_FOUND') return jsonResponseFor(req, { error: message }, 404);
    console.error('[search-coupon-merchants] fatal:', error);
    return jsonResponseFor(req, { error: 'SEARCH_UNAVAILABLE' }, 503);
  }
});
