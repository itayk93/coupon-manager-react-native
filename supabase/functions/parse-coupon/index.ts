// Supabase Edge Function: parse-coupon
// Uses the Claude API (Anthropic) to extract structured coupon fields from free
// text or an uploaded image, and logs token usage to the gpt_usage table.
//
// Env vars required (set with `supabase secrets set`):
//   ANTHROPIC_API_KEY   - Claude API key
//   SUPABASE_URL        - injected automatically
//   SUPABASE_SERVICE_ROLE_KEY - injected automatically
//
// Deploy: supabase functions deploy parse-coupon

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-8';

const COUPON_SCHEMA = {
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

const SYSTEM_PROMPT = `אתה עוזר שמחלץ פרטי קופון מטקסט או מתמונה של קבלה/הודעה בעברית.
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
    const { text, imageBase64, user_id } = await req.json();
    if (!text && !imageBase64) return jsonResponse({ error: 'צריך טקסט או תמונה' }, 400);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY לא מוגדר' }, 500);

    const content: unknown[] = [];
    if (imageBase64) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
      });
    }
    content.push({
      type: 'text',
      text: text
        ? `חלץ את פרטי הקופון מהטקסט הבא:\n\n${text}`
        : 'חלץ את פרטי הקופון מהתמונה המצורפת.',
    });

    const anthropicResp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        output_config: { format: { type: 'json_schema', schema: COUPON_SCHEMA } },
        messages: [{ role: 'user', content }],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      return jsonResponse({ error: `Claude API error: ${errText}` }, 502);
    }

    const data = await anthropicResp.json();
    const textBlock = (data.content || []).find((b: any) => b.type === 'text');
    if (!textBlock) return jsonResponse({ error: 'לא התקבל פלט מהמודל' }, 502);

    let coupon;
    try {
      coupon = JSON.parse(textBlock.text);
    } catch {
      return jsonResponse({ error: 'פלט המודל אינו JSON תקין' }, 502);
    }

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
        prompt_tokens: usage.input_tokens ?? null,
        completion_tokens: usage.output_tokens ?? null,
        total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
        response_text: textBlock.text,
      });
    } catch (_) {
      // ignore logging failures
    }

    return jsonResponse({ coupon });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
