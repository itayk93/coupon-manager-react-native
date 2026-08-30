// Supabase Edge Function: newsletter-preview
//
// Sends ONE newsletter's teaser email to ONE explicit address, for review
// before a real send. Does not touch newsletter_sendings, does not flip
// is_sent, never fans out to the subscriber list. Admin only.
//
// The teaser template is duplicated here (small) rather than imported from
// _shared/emailTemplate.ts, to keep this function a single deployable file.
// Keep it in sync with newsletterTeaserEmailHtml() there.
//
// Body: { newsletter_id: number, to: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function teaserHtml(o: { subject: string; heroImageUrl: string | null; previewText: string; webUrl: string }): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
  const url = esc(o.webUrl);
  const LOGO = "https://coupons.itaykarkason.com/newsletter-logo.png";
  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;background:#eeece5;padding:24px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td align="center" style="padding:10px 20px;font-size:12px;color:#98a2b3">
        <a href="${url}" style="color:#98a2b3">לא רואים את המייל כמו שצריך? צפייה בדפדפן</a>
      </td></tr>
      <tr><td align="right" style="background:#15202e;padding:16px 24px">
        <img src="${LOGO}" alt="קופון מאסטר" width="150" style="display:block;width:150px;max-width:60%;height:auto">
      </td></tr>
      ${o.heroImageUrl ? `<tr><td><img src="${esc(o.heroImageUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto"></td></tr>` : ""}
      <tr><td style="padding:24px 28px 8px"><h1 style="margin:0;font-size:23px;color:#101828;line-height:1.35">${esc(o.subject)}</h1></td></tr>
      <tr><td style="padding:0 28px 20px;font-size:15px;line-height:1.7;color:#475467">${esc(o.previewText)}</td></tr>
      <tr><td align="center" style="padding:8px 28px 34px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#1f6fd1;border-radius:12px">
          <a href="${url}" style="display:inline-block;padding:14px 36px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold">לצפייה המלאה</a>
        </td></tr></table>
      </td></tr>
      <tr><td align="center" style="padding:0 28px 26px;font-size:12px;color:#98a2b3">קופון מאסטר · הארנק החכם לקופונים ושוברים</td></tr>
    </table>
  </td></tr></table>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const asCaller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } },
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
    .select("title, email_subject, hero_image_url, preview_text, web_url")
    .eq("id", newsletter_id)
    .single();
  if (!nl) return json({ error: "ניוזלטר לא נמצא" }, 404);
  if (!nl.web_url) return json({ error: "לניוזלטר אין קובץ עיצוב" }, 400);

  const subject = nl.email_subject || nl.title;
  const html = teaserHtml({
    subject,
    heroImageUrl: nl.hero_image_url,
    previewText: nl.preview_text || "",
    webUrl: nl.web_url,
  });

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
      subject: `[תצוגה מקדימה] ${subject}`,
      htmlContent: html,
    }),
  });

  const text = await resp.text();
  return json({ ok: resp.ok, status: resp.status, to: recipient, detail: text.slice(0, 400) });
});
