// The wording of a notification, written fresh each time.
//
// The catalogue in notificationTypes.ts holds one sentence per kind. That is
// exactly right the first time somebody reads it and slightly deadening the
// fifth: the same eleven words about last month's savings, every month, for
// years. So the facts stay fixed and the sentence does not — a small model gets
// the numbers and the house voice, and writes that particular message.
//
// The rules below are what keep that from being a risk rather than a charm:
//
//  - the model is never told anything it could get wrong on its own. It gets
//    the numbers already formatted, and is forbidden from producing new ones.
//  - every result is checked before it is used. A message missing its amount,
//    carrying a digit nobody gave it, drifting out of Hebrew, or running long
//    is thrown away.
//  - a failure of any kind — no key, a timeout, a refusal, a bad shape — falls
//    back to the written sentence. A notification is never lost to phrasing.

import { safeFetch } from './ssrf.ts';
import { copyFor, type NotificationCopy, type NotificationTypeId } from './notificationTypes.ts';
import { MAX_BODY, MAX_TITLE, isUsable } from './notificationVoiceRules.ts';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
/** Same small model the coupon parser uses; this is a one-sentence job. */
const MODEL = 'gpt-5-mini';
const TIMEOUT_MS = 6000;

const SYSTEM_PROMPT = `אתה כותב את ההתראות של "קופון מאסטר", אפליקציה ישראלית לניהול קופונים.

הקול: חבר שמנהל לך את הכסף. חם, קליל, קצת שנון, לעולם לא מתחנף ולעולם לא מוכר.
כמו הודעה מחבר טוב — לא כמו דיוור.

חוקים מוחלטים:
1. עברית בלבד. מותר שם מותג לועזי אם הוא ניתן לך ככה. כל מילות החיבור חייבות להיות בעברית; אסור לכתוב from, with, by או מילת חיבור לועזית אחרת.
2. כתוב "ש״ח" ולא סימן שקל. אל תשנה, תעגל או תמציא שום מספר — השתמש בסכומים בדיוק כפי שניתנו לך.
3. אל תמציא עובדות. מותר לך רק מה שכתוב ב-facts.
4. כותרת: עד ${MAX_TITLE} תווים. גוף: משפט או שניים, עד ${MAX_BODY} תווים.
5. בלי סימני קריאה כפולים, בלי CAPS, בלי "!!!", בלי קלישאות שיווק ("אל תפספס", "מבצע", "הזדמנות אחרונה").
6. אימוג'י אחד לכל היותר, ורק כשזה באמת שמח. הודעה על משהו שהתפספס — בלי אימוג'י בכלל.
7. אל תפנה בשם. אל תפתח ב"שלום".
8. כל פעם נסח אחרת. אותה עובדה, ניסוח חדש.

החזר JSON בלבד: {"title": "...", "body": "..."}`;

/** What the model may say about each kind, in a line it cannot contradict. */
const INTENT: Record<NotificationTypeId, string> = {
  expiry: 'קופון עומד לפוג בקרוב. התזכורת דחופה אבל לא מלחיצה — יש עוד זמן לפעול.',
  monthly_summary: 'סיכום החודש שעבר. גאווה שקטה, בלי חגיגיות מוגזמת.',
  idle_money: 'יש כסף בארנק שלא נגעו בו הרבה זמן. תזכורת עדינה, בלי נזיפה.',
  share_received: 'מישהו הזמין את המשתמש לאשר שיתוף קופון. אין גישה לקופון לפני האישור.',
  balance_updated: 'בדקנו יתרה עבור המשתמש והיא השתנתה. ענייני ומועיל — האפליקציה עבדה ברקע.',
  coupon_finished: 'המשתמש סיים לנצל קופון עד הסוף. רגע קטן של סיפוק.',
  savings_milestone: 'המשתמש עבר סכום עגול של חיסכון מצטבר. חגיגה קטנה.',
  coupon_milestone: 'הארנק הגיע למספר עגול של קופונים. עידוד.',
  expired_unused: 'קופון פג בלי שנוצל וכסף התפספס. אמפתי, בלי להאשים, ומציע לתזכר מוקדם יותר בפעם הבאה.',
  nearby_store: 'המשתמש נמצא ממש עכשיו ליד חנות שיש לו בה קופון פעיל. קצר, מיידי, שימושי.',
};

/**
 * The sentence for one notification, written by the model, or the catalogue's
 * if anything at all goes wrong.
 *
 * `supabase` is optional and used only to record token spend, in the same table
 * the coupon parser writes to.
 */
export async function phrase(
  type: NotificationTypeId,
  payload: Record<string, any>,
  options: { supabase?: any; userId?: number } = {},
): Promise<NotificationCopy> {
  const written = copyFor(type, payload);
  const apiKey = Deno.env.get('OPENAI_API_KEY_V2') || Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return written;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await safeFetch(OPENAI_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: 300,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              intent: INTENT[type],
              facts: payload,
              // The written sentence goes along as a reference for tone and
              // length, explicitly not as something to copy.
              reference: { title: written.title, body: written.body },
              instruction: 'כתוב ניסוח חדש לאותה עובדה. אל תעתיק את reference.',
            }),
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return written;
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') return written;

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return written;
    }
    if (!isUsable(parsed, payload)) return written;

    if (options.supabase && options.userId) {
      // Best-effort, same table the parser logs to.
      try {
        const usage = data.usage || {};
        await options.supabase.from('gpt_usage').insert({
          user_id: options.userId,
          created: new Date().toISOString(),
          model: MODEL,
          prompt_tokens: usage.prompt_tokens ?? null,
          completion_tokens: usage.completion_tokens ?? null,
          total_tokens: usage.total_tokens ?? null,
        });
      } catch {
        // Never let accounting cost a notification.
      }
    }

    return { title: parsed.title.trim(), body: parsed.body.trim(), link: written.link };
  } catch {
    return written;
  } finally {
    clearTimeout(timer);
  }
}
