// Vercel serverless function: serve a hosted newsletter design bundle with the
// right Content-Type.
//
// Supabase (Storage public URLs AND edge functions) forces text/plain on HTML
// to prevent phishing hosting, so the newsletter page has to be proxied from
// somewhere that doesn't. This is that somewhere.
//
//   /api/n?id=26            -> newsletters/26/index.html   (text/html)
//   /api/n?id=26&f=logo.png -> newsletters/26/logo.png     (by extension)

const SUPABASE_URL = "https://dugjsiyenazpsoiyduuz.supabase.co";

const TYPES = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8", json: "application/json; charset=utf-8",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", ico: "image/x-icon",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
};

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  const f = String(req.query.f || "index.html");
  if (!/^\d+$/.test(id) || /\.\.|^\/|\\/.test(f)) {
    res.status(400).send("bad request");
    return;
  }
  const ext = f.toLowerCase().split(".").pop() || "";
  const upstream = `${SUPABASE_URL}/storage/v1/object/public/newsletters/${id}/${f}`;

  const r = await fetch(upstream);
  if (!r.ok) {
    res.status(404).send("not found");
    return;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader("Content-Type", TYPES[ext] || "application/octet-stream");
  // Short edge cache: a newsletter can be re-uploaded and should refresh fast.
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(buf);
}
