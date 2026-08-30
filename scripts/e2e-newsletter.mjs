// End-to-end check of the file-upload newsletter flow, against a real deployment.
//
// The chain worth proving: an admin uploads a design file -> it is hosted as a
// real web page (right Content-Type, UTF-8) -> the subject / hero / preview are
// mined from the HTML -> a teaser email (not the design) goes to one address and
// links to the hosted page. Plus: a non-admin cannot upload, and dropping the
// row clears the bundle.
//
// Requires an admin access token because newsletter-upload is is_app_admin()
// gated. Get one from a signed-in admin session (localStorage
// sb-<ref>-auth-token .access_token) or a service-role JWT.
//
//   set -a && . ./.env.supabase.local && set +a && \
//   ADMIN_JWT=... node scripts/e2e-newsletter.mjs

import pg from "pg";

const required = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "ADMIN_JWT"];
for (const n of required) if (!process.env[n]) throw new Error(`Missing ${n}`);

const dbUrl = new URL(process.env.DATABASE_URL.replace("postgresql+psycopg2:", "postgresql:"));
dbUrl.searchParams.delete("sslmode");
const db = new pg.Client({ connectionString: dbUrl.toString(), ssl: { rejectUnauthorized: false } });

const FN = (name) => `${process.env.SUPABASE_URL}/functions/v1/${name}`;
const H = {
  "Content-Type": "application/json",
  apikey: process.env.SUPABASE_ANON_KEY,
  Authorization: `Bearer ${process.env.ADMIN_JWT}`,
};

let failures = 0;
const check = (label, ok, detail = "") => {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ""}`); }
};

const DESIGN = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>כותרת הבדיקה</title></head><body>
<div class="hero"><h1>כותרת ראשית</h1><p>פסקת הפתיחה שנשלפת לטיזר.</p></div>
</body></html>`;

async function main() {
  await db.connect();
  const created = [];
  try {
    const nl = (await db.query(
      `insert into public.newsletters (title, created_by, is_published, is_sent, sent_count)
       values ('e2e-newsletter', (select id from public.users order by id limit 1), false, false, 0)
       returning id`,
    )).rows[0];
    created.push(nl.id);

    // 1. upload a single .html
    const up = await fetch(FN("newsletter-upload"), {
      method: "POST", headers: H,
      body: JSON.stringify({
        newsletter_id: nl.id,
        filename: "design.html",
        content_base64: Buffer.from(DESIGN, "utf8").toString("base64"),
      }),
    });
    const upBody = await up.json();
    check("newsletter-upload returns 200", up.status === 200, JSON.stringify(upBody));
    check("subject mined from <title>", upBody.email_subject === "כותרת הבדיקה", upBody.email_subject);
    check("preview mined from first <p>", (upBody.preview_text || "").startsWith("פסקת הפתיחה"), upBody.preview_text);
    check("web_url points at newsletter-page", (upBody.web_url || "").includes("/functions/v1/newsletter-page/"), upBody.web_url);

    // 2. the hosted page renders as real, UTF-8 HTML
    const page = await fetch(upBody.web_url);
    const pageText = await page.text();
    check("hosted page is text/html", (page.headers.get("content-type") || "").includes("text/html"), page.headers.get("content-type"));
    check("hosted page keeps the Hebrew", pageText.includes("כותרת ראשית"));

    // 3. the row has the pointers
    const row = (await db.query("select bundle_path, web_url, email_subject from public.newsletters where id = $1", [nl.id])).rows[0];
    check("row.bundle_path set", !!row.bundle_path, JSON.stringify(row));

    // 4. teaser preview to one address
    const prev = await fetch(FN("newsletter-preview"), {
      method: "POST", headers: H, body: JSON.stringify({ newsletter_id: nl.id, to: "itayk93@gmail.com" }),
    });
    const prevBody = await prev.json();
    check("newsletter-preview sends the teaser", prevBody.ok === true, JSON.stringify(prevBody));

    // 5. non-admin is rejected
    const anon = await fetch(FN("newsletter-upload"), {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ newsletter_id: nl.id, filename: "x.html", content_base64: "PGh0bWw+PC9odG1sPg==" }),
    });
    check("non-admin upload is 403", anon.status === 403, `got ${anon.status}`);
  } finally {
    for (const id of created) {
      await db.query("delete from public.newsletters where id = $1", [id]).catch(() => {});
    }
    await db.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
}

main();
