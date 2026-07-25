// Supabase Edge Function: parse-coupon
// Uses the OpenAI API (gpt-4o-mini) to extract structured coupon fields from free
// text or an uploaded image, and logs token usage to the gpt_usage table.
//
// Env vars required (set with `supabase secrets set`):
//   OPENAI_API_KEY_V2         - OpenAI API key (preferred)
//   OPENAI_API_KEY            - OpenAI API key (fallback)
//   SUPABASE_URL              - injected automatically
//   SUPABASE_SERVICE_ROLE_KEY - injected automatically
//
// Deploy: supabase functions deploy parse-coupon

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

const SINGLE_COUPON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    company: { type: ['string', 'null'], description: 'שם החברה / המותג' },
    code: { type: ['string', 'null'], description: 'קוד הקופון או מספר הכרטיס' },
    value: { type: ['number', 'null'], description: 'הערך המקורי בשקלים' },
    cost: { type: ['number', 'null'], description: 'העלות ששולמה בפועל בשקלים' },
    expiration: { type: ['string', 'null'], description: 'תאריך תפוגה בפורמט YYYY-MM-DD' },
    description: { type: ['string', 'null'], description: 'תיאור או הערות' },
    cvv: { type: ['string', 'null'], description: 'קוד CVV אם קיים' },
    card_exp: { type: ['string', 'null'], description: 'תוקף כרטיס בפורמט MM/YY' },
  },
  required: ['company', 'code', 'value', 'cost', 'expiration', 'description', 'cvv', 'card_exp'],
};

const COUPONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    coupons: {
      type: 'array',
      minItems: 1,
      description: 'כל הקופונים הנפרדים שזוהו בטקסט או בתמונה',
      items: SINGLE_COUPON_SCHEMA,
    },
  },
  required: ['coupons'],
};

const SYSTEM_PROMPT = `אתה עוזר שמחלץ קופון אחד או כמה קופונים מטקסט או מתמונה של קבלה/הודעה בעברית.
החזר פריט נפרד במערך coupons עבור כל קופון שזוהה.
חשוב מאוד: קודי קופון נפרדים ושונים הם התנאי להחזרת כמה קופונים. אם בטקסט מופיע קוד קופון/מספר שובר אחד בלבד, החזר קופון אחד בלבד! אל תייצר פריטים מרובים עקב חזרות טקסטואליות או סכומים המופיעים פעמיים בטקסט (כגון טקסט אתר שחוזר על סכום השובר).
כאשר הטקסט מציין כמות ויש כמה קודים שונים, החזר קופון נפרד לכל קוד. שכפל לכל אחד מהם פרטים משותפים כמו חברה, שווי ועלות.
כאשר לכל קופון מצוינים פרטים שונים, שייך לכל קוד רק את הפרטים המתאימים לו. אל תאחד כמה קודים בשדה code אחד.
חלץ את השדות הבאים במדויק. אם שדה לא קיים, החזר null עבורו.
- company: שם החברה
- code: קוד הקופון (בדיוק כפי שמופיע, כולל אותיות ומספרים)
- value: הערך המקורי במספר (רק המספר, בשקלים)
- cost: העלות ששולמה (אם לא מצוין, השאר null)
- expiration: תאריך תפוגה בפורמט YYYY-MM-DD בלבד
- description: תיאור קצר אם רלוונטי
- cvv, card_exp: רק אם מדובר בכרטיס נטען`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { text, imageBase64, user_id, companyNames } = await req.json();
    if (!text && !imageBase64) return jsonResponse({ error: 'צריך טקסט או תמונה' }, 400);

    // Guidance so the model prefers an existing company name (matching the
    // mechanism used in the Flask/iOS apps). Client-side matching still snaps the
    // result to the exact stored name afterwards.
    const companyGuidance = Array.isArray(companyNames) && companyNames.length
      ? `\n\nאלו הן רשימת החברות הקיימות במאגר שלנו:\n${companyNames.join(', ')}\n\nאנא זהה את החברה מהטקסט:\n- בצע התאמה ללא תלות ברישיות (case-insensitive), לדוגמה WOLT / wolt / וולט הם אותה חברה.\n- אם שם החברה שזיהית דומה מאוד לאחת החברות ברשימה, החזר את שם החברה בדיוק כפי שהוא מופיע ברשימה.\n- אם אין התאמה מספקת, החזר את שם החברה המקורי שזיהית.`
      : '';

    const apiKey = Deno.env.get('OPENAI_API_KEY_V2') || Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return jsonResponse(
        { error: 'שירות פענוח הקופונים אינו מוגדר. חסר OPENAI_API_KEY ב-Supabase Secrets.' },
        503
      );
    }

    const content: unknown[] = [
      {
        type: 'text',
        text: (text
          ? `חלץ את פרטי הקופון מהטקסט הבא:\n\n${text}`
          : 'חלץ את פרטי הקופון מהתמונה המצורפת.') + companyGuidance,
      },
    ];
    if (imageBase64) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
      });
    }

    const openaiResp = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'coupons', strict: true, schema: COUPONS_SCHEMA },
        },
      }),
    });

    if (!openaiResp.ok) {
      const errText = await openaiResp.text();
      console.error('OpenAI API error', openaiResp.status, errText);
      const message = openaiResp.status === 401
        ? 'שירות פענוח הקופונים אינו מחובר למפתח OpenAI תקין.'
        : 'שירות פענוח הקופונים נכשל מול ספק ה-AI. נסה שוב מאוחר יותר.';
      return jsonResponse({ error: message }, 502);
    }

    const data = await openaiResp.json();
    const outputText = data.choices?.[0]?.message?.content;
    if (!outputText) return jsonResponse({ error: 'לא התקבל פלט מהמודל' }, 502);

    let coupons;
    try {
      const parsed = JSON.parse(outputText);
      coupons = parsed.coupons;
    } catch {
      return jsonResponse({ error: 'פלט המודל אינו JSON תקין' }, 502);
    }

    if (!Array.isArray(coupons) || coupons.length === 0) {
      return jsonResponse({ error: 'לא זוהו קופונים בטקסט או בתמונה' }, 422);
    }

    // Deduplicate parsed coupons by unique code
    const seenCodes = new Set<string>();
    coupons = coupons.filter((c: any) => {
      const code = c?.code ? String(c.code).trim().toLowerCase() : null;
      if (!code) return true;
      if (seenCodes.has(code)) return false;
      seenCodes.add(code);
      return true;
    });

    // Log token usage (best-effort)
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const usage = data.usage || {};
      await supabase.from('gpt_usage').insert({
        user_id: user_id ?? 0,
        created: new Date().toISOString(),
        model: MODEL,
        prompt_tokens: usage.prompt_tokens ?? null,
        completion_tokens: usage.completion_tokens ?? null,
        total_tokens: usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
        response_text: outputText,
      });
    } catch (_) {
      // ignore logging failures
    }

    // Keep `coupon` temporarily for clients that still expect the old contract.
    return jsonResponse({ coupons, coupon: coupons[0] });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
