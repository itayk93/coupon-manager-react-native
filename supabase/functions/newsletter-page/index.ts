// Supabase Edge Function: newsletter-page
//
// Serves a hosted newsletter design bundle as a real web page. Supabase Storage
// forces text/plain on public .html/.css/.js (anti-phishing), which would show
// source instead of rendering and stop CSS/JS from working. This reads the
// object with the service role and returns it with the right Content-Type.
//
//   GET .../newsletter-page/<id>            -> newsletters/<id>/index.html
//   GET .../newsletter-page/<id>/<rel/path> -> newsletters/<id>/<rel/path>
//
// Public (verify_jwt = false): a newsletter is opened from an email.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function contentTypeFor(path: string): string {
  const ext = path.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8", json: "application/json; charset=utf-8",
    svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", ico: "image/x-icon",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
    txt: "text/plain; charset=utf-8",
  };
  return map[ext] || "application/octet-stream";
}

Deno.serve(async (req) => {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  // Drop everything up to and including the "newsletter-page" segment, then
  // whatever leads the remainder that is not the numeric id.
  const fnIdx = segments.indexOf("newsletter-page");
  let rest = fnIdx >= 0 ? segments.slice(fnIdx + 1) : segments.slice();
  while (rest.length && !/^\d+$/.test(rest[0])) rest = rest.slice(1);
  if (rest.length === 0) return new Response("not found", { status: 404 });

  const id = rest[0];
  const objectPath = rest.length === 1 ? `${id}/index.html` : rest.join("/");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await admin.storage.from("newsletters").download(objectPath);
  if (error || !data) return new Response("not found", { status: 404 });

  return new Response(await data.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(objectPath),
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
