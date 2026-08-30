// Supabase Edge Function: newsletter-preview
//
// Sends ONE newsletter's rendered HTML to ONE explicit address, for review
// before a real send. It does not touch newsletter_sendings, does not flip
// is_sent, and never fans out to the subscriber list - that is send-emails
// (mode: "newsletter"). Admin only.
//
// Body: { newsletter_id: number, to: string }
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (auto),
//      BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: isAdmin } = await asCaller.rpc("is_app_admin");
  if (!isAdmin) return json({ error: "אין הרשאה" }, 403);

  const { newsletter_id, to } = await req.json().catch(() => ({}));
  const recipient = String(to ?? "").trim();
  if (!recipient || !newsletter_id) return json({ error: "missing newsletter_id / to" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: nl } = await admin
    .from("newsletters")
    .select("title, content, main_title, custom_html")
    .eq("id", newsletter_id)
    .single();
  if (!nl) return json({ error: "ניוזלטר לא נמצא" }, 404);

  const html = nl.custom_html
    || `<div dir="rtl"><h1>${nl.main_title || nl.title}</h1>${nl.content ?? ""}</div>`;

  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) return json({ error: "BREVO_API_KEY missing" }, 500);

  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: {
        email: Deno.env.get("BREVO_SENDER_EMAIL") || "hello@itaykarkason.com",
        name: Deno.env.get("BREVO_SENDER_NAME") || "קופון מאסטר",
      },
      to: [{ email: recipient }],
      subject: `[תצוגה מקדימה] ${nl.title}`,
      htmlContent: html,
    }),
  });

  const text = await resp.text();
  return json({ ok: resp.ok, status: resp.status, to: recipient, detail: text.slice(0, 400) });
});
