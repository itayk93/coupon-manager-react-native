// Supabase Edge Function: newsletter-upload
//
// Admin uploads a design bundle (ZIP from Claude Design, or a single .html).
// This:
//   1. unzips it (in memory)
//   2. pushes every file to the public "newsletters" Storage bucket under
//      newsletters/<id>/
//   3. parses the entry HTML for a subject (<title>/<h1>), a hero image (first
//      <img>), and a preview paragraph (first <p>)
//   4. rewrites the entry HTML's relative src/href to absolute Storage URLs
//   5. writes bundle_path / web_url / email_subject / hero_image_url /
//      preview_text onto the newsletters row (without clobbering fields the
//      admin already edited by hand)
//
// The email itself is NOT this bundle - send-emails / newsletter-preview render
// newsletterTeaserEmailHtml() which links to web_url.
//
// Body: { newsletter_id: number, filename: string, content_base64: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BlobReader, ZipReader, Uint8ArrayWriter } from "jsr:@zip-js/zip-js@2.7.62";
import { parse } from "npm:node-html-parser@6.1.13";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_BYTES = 5 * 1024 * 1024;

function contentTypeFor(path: string): string {
  const ext = path.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    html: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript",
    json: "application/json", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  };
  return map[ext] || "application/octet-stream";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const caller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } },
  );
  const { data: isAdmin } = await caller.rpc("is_app_admin");
  if (!isAdmin) return json({ error: "אין הרשאה" }, 403);

  const { newsletter_id, filename, content_base64 } = await req.json().catch(() => ({}));
  if (!newsletter_id || !filename || !content_base64) return json({ error: "missing fields" }, 400);

  const bytes = Uint8Array.from(atob(content_base64), (c) => c.charCodeAt(0));
  if (bytes.byteLength > MAX_BYTES) return json({ error: "הקובץ גדול מ-5MB" }, 413);

  const name = String(filename).toLowerCase();
  let files: { path: string; bytes: Uint8Array }[];
  if (name.endsWith(".zip")) {
    const zip = new ZipReader(new BlobReader(new Blob([bytes])));
    const entries = (await zip.getEntries()).filter((e) => !e.directory && e.getData);
    files = await Promise.all(entries.map(async (e) => ({
      path: e.filename.replace(/^\/+/, "").replace(/\\/g, "/"),
      bytes: await e.getData!(new Uint8ArrayWriter()),
    })));
    await zip.close();
  } else if (name.endsWith(".html") || name.endsWith(".htm")) {
    files = [{ path: "index.html", bytes }];
  } else {
    return json({ error: "רק ZIP או HTML" }, 400);
  }

  // Ignore a wrapping top-level folder ("bundle/index.html" -> "index.html").
  const top = files[0]?.path.split("/")[0];
  if (top && files.every((f) => f.path.startsWith(top + "/"))) {
    files = files.map((f) => ({ ...f, path: f.path.slice(top.length + 1) }));
  }

  const entry = files.find((f) => f.path === "index.html")
    || files.find((f) => f.path.toLowerCase().endsWith(".html"))
    || files.find((f) => f.path.toLowerCase().endsWith(".htm"));
  if (!entry) return json({ error: "אין קובץ HTML בחבילה" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const dir = String(newsletter_id);
  const base = `${dir}/`;
  // Assets and the page are served through newsletter-page, which sets real
  // Content-Types (Storage forces text/plain on public html/css/js).
  const serveBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/newsletter-page/${base}`;

  // Replace any previous bundle.
  const { data: existing } = await admin.storage.from("newsletters").list(dir);
  if (existing?.length) {
    await admin.storage.from("newsletters").remove(existing.map((o) => base + o.name));
  }

  for (const f of files) {
    if (f === entry) continue;
    await admin.storage.from("newsletters").upload(base + f.path, f.bytes, {
      contentType: contentTypeFor(f.path),
      upsert: true,
    });
  }

  let html = new TextDecoder().decode(entry.bytes);
  const root = parse(html);
  const subject = (root.querySelector("title")?.textContent
    || root.querySelector("h1")?.textContent || "").trim().slice(0, 200);
  const firstImg = root.querySelector("img")?.getAttribute("src") || null;
  const firstP = (root.querySelector("p")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200);

  html = html.replace(
    /(src|href)=("|')(?!https?:|data:|mailto:|tel:|#)([^"']+)\2/gi,
    (_m, attr, q, path) => `${attr}=${q}${serveBase}${String(path).replace(/^\.?\//, "")}${q}`,
  );
  const heroImageUrl = firstImg && !/^(https?:|data:)/i.test(firstImg)
    ? serveBase + firstImg.replace(/^\.?\//, "")
    : firstImg;

  await admin.storage.from("newsletters").upload(base + "index.html", new TextEncoder().encode(html), {
    contentType: "text/html",
    upsert: true,
  });

  const { data: current } = await admin
    .from("newsletters")
    .select("email_subject,hero_image_url,preview_text")
    .eq("id", newsletter_id)
    .single();

  const patch = {
    bundle_path: base + "index.html",
    web_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/newsletter-page/${dir}`,
    email_subject: current?.email_subject || subject,
    hero_image_url: current?.hero_image_url || heroImageUrl,
    preview_text: current?.preview_text || firstP,
  };
  await admin.from("newsletters").update(patch).eq("id", newsletter_id);

  return json({ ...patch, file_count: files.length });
});
