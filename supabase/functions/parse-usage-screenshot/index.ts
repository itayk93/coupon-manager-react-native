import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { safeFetch } from "../_shared/ssrf.ts";

const MAX_IMAGE_CHARS = 8 * 1024 * 1024;
const MODEL = "gpt-5-mini";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    couponCode: { type: ["string", "null"] },
    couponCodeConfidence: { type: "number", minimum: 0, maximum: 1 },
    companyName: { type: ["string", "null"] },
    warnings: { type: "array", items: { type: "string" } },
    usages: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          amount: { type: "number" },
          placeName: { type: "string" },
          usedAt: { type: ["string", "null"] },
          details: { type: "string" },
        },
        required: ["amount", "placeName", "usedAt", "details"],
      },
    },
  },
  required: ["couponCode", "couponCodeConfidence", "companyName", "warnings", "usages"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });
  try {
    let caller;
    try { caller = await requireUser(req); } catch { return jsonResponse({ error: "נדרשת התחברות" }, 401); }
    const { imageBase64 } = await req.json();
    if (typeof imageBase64 !== "string" || !imageBase64) return jsonResponse({ error: "חסרה תמונה" }, 400);
    if (imageBase64.length > MAX_IMAGE_CHARS) return jsonResponse({ error: "התמונה גדולה מדי" }, 413);
    if (!/^[A-Za-z0-9+/=\s]+$/.test(imageBase64)) return jsonResponse({ error: "פורמט תמונה לא תקין" }, 400);

    const apiKey = Deno.env.get("OPENAI_API_KEY_V2") || Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return jsonResponse({ error: "שירות AI אינו מוגדר" }, 503);

    const response = await safeFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: 2048,
        response_format: { type: "json_schema", json_schema: { name: "coupon_usages", strict: true, schema } },
        messages: [
          { role: "system", content: `חלץ מצילום מסך של היסטוריית קופון את קוד הקופון ואת כל השימושים. couponCode הוא הקוד בדיוק כפי שנראה, ללא ניחוש; אם אינו נראה החזר null. couponCodeConfidence בין 0 ל-1. companyName הוא מותג הקופון אם נראה. warnings מכיל אי-ודאויות קצרות. החזר שורה נפרדת לכל עסקה. amount הוא סכום השימוש החיובי בשקלים; אם השורה נראית שימוש אך הסכום חתוך או לא קריא החזר amount 0 והוסף warning, אל תשמיט את השורה. placeName הוא שם העסק והסניף/האזור, בלי סכום ובלי תאריך. usedAt בפורמט ISO 8601 לפי שעון ישראל כאשר מופיעים תאריך ושעה; שנים דו-ספרתיות הן 20xx. אם אין מועד החזר null. details הוא תיאור קצר. אל תחלץ יתרה, שווי קופון, כותרות או קוד קופון כשימוש.` },
          { role: "user", content: [
            { type: "text", text: "קרא את כל השימושים בצילום. אל תדלג על שורות." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ] },
        ],
      }),
    });
    const raw = await response.text();
    if (!response.ok) return jsonResponse({ error: "פענוח התמונה נכשל" }, 502);
    const payload = JSON.parse(raw);
    const output = JSON.parse(payload.choices?.[0]?.message?.content || "{}");
    // A row the model read but could not price (amount cut off, glare) must not
    // sink the whole parse: keep it with amount 0 so the review screen shows it
    // for the user to fill in. Only a screenshot with no rows at all is a 422.
    const usages = (Array.isArray(output.usages) ? output.usages : [])
      .filter((u: any) => String(u.placeName || "").trim())
      .map((u: any) => ({
        ...u,
        amount: Number.isFinite(u.amount) && u.amount > 0 ? u.amount : 0,
      }));
    if (!usages.length) return jsonResponse({ error: "לא זוהו שימושים בצילום המסך" }, 422);
    const missingAmount = usages.filter((u: any) => u.amount === 0).length;

    try {
      await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
        .from("gpt_usage").insert({ user_id: caller.id, created: new Date().toISOString(), model: MODEL,
          prompt_tokens: payload.usage?.prompt_tokens ?? null, completion_tokens: payload.usage?.completion_tokens ?? null,
          total_tokens: payload.usage?.total_tokens ?? null, response_text: payload.choices?.[0]?.message?.content ?? null });
    } catch { /* logging must not break parsing */ }
    return jsonResponse({
      couponCode: typeof output.couponCode === "string" ? output.couponCode.trim() : null,
      couponCodeConfidence: Math.max(0, Math.min(1, Number(output.couponCodeConfidence) || 0)),
      companyName: typeof output.companyName === "string" ? output.companyName.trim() : null,
      warnings: [
        ...(missingAmount > 0 ? [`ל-${missingAmount} שורות לא זוהה סכום — יש להשלים ידנית`] : []),
        ...(Array.isArray(output.warnings) ? output.warnings.map(String) : []),
      ].slice(0, 6),
      usages,
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
