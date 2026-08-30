# File-Upload Newsletters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Replace the newsletter `content`/`custom_html` text fields with a ZIP/HTML file upload: the file is hosted as a full web page (Supabase Storage), and the email becomes an auto-generated email-safe teaser that links to it.

**Architecture:** New `newsletter-upload` edge function unzips the upload, pushes every file to a public `newsletters` Storage bucket, parses the entry HTML for a subject / hero image / preview paragraph, rewrites relative `src`/`href` to absolute Storage URLs, and stores pointers on the `newsletters` row. `send-emails` and `newsletter-preview` render a fixed `newsletterTeaserEmailHtml()` template instead of raw HTML. The admin tab swaps its text fields for a file picker plus three editable extracted fields.

**Tech Stack:** Supabase Postgres 15 + Storage, Deno edge functions (`jsr:@zip-js/zip-js`, `deno-dom`), Brevo, React Native + expo-router + expo-document-picker + expo-file-system, vitest.

## Global Constraints

- Commit straight to `main`, no branches/PRs. No AI-authorship trailers.
- `git add <explicit paths>` — never `-A` (parallel uncommitted work is common here).
- JS bundle ≤ 10MB, packed assets ≤ 6MB (`npm run size`). `expo-document-picker` is the only new client dep — verify size after install, state the number.
- Migrations: local file in `supabase/migrations/`, applied via Supabase MCP `apply_migration`, local filename realigned to the remote version string afterward.
- Edge secrets cannot be set from here. Reuse existing ones (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` — already set, send-emails uses them). Auto-injected: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `types.ts` edited surgically (table block Row/Insert/Update), NOT regenerated.
- Admin gate for edge functions: create a client with the caller's `Authorization` header, `await client.rpc("is_app_admin")`, 403 if not true (pattern from `newsletter-preview`).
- Hebrew UI copy.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/<v>_newsletters_file_upload_columns.sql` | +5 cols, −4 cols, delete test row 24 | create |
| `supabase/migrations/<v>_newsletters_storage_bucket.sql` | `newsletters` public bucket + policies | create |
| `supabase/functions/_shared/emailTemplate.ts` | add `newsletterTeaserEmailHtml()` | modify |
| `supabase/functions/newsletter-upload/index.ts` | unzip → Storage → parse → rewrite → update row | create |
| `supabase/functions/newsletter-preview/index.ts` | render teaser instead of raw html | modify |
| `supabase/functions/send-emails/index.ts` | `handleNewsletter` renders teaser | modify |
| `src/integrations/supabase/types.ts` | `newsletters` block: +5 −4 cols | modify |
| `src/hooks/useAdminManagement.ts` | newsletter hooks: new select cols; drop-storage on delete | modify |
| `src/hooks/useNewsletterUpload.ts` | pick file → base64 → invoke `newsletter-upload` | create |
| `src/screens/admin/NewslettersTab.tsx` | file picker + 3 editable extracted fields | modify |
| `package.json` / `app.config.ts` | `expo-document-picker` | modify |
| `scripts/e2e-newsletter.mjs` | upload → host → extract → teaser send | create |
| `docs/SESSION_2026-08-29_DB_UNUSED_COLUMNS_AUDIT.md` | Phase 4 note | modify |

---

## Task 1: `newsletters` schema + Storage bucket

**Files:** create both migration files; modify `types.ts`

- [ ] **Step 1 — write `<v>_newsletters_file_upload_columns.sql`:**
```sql
begin;
alter table public.newsletters
  add column bundle_path    text,
  add column web_url        text,
  add column email_subject  text,
  add column hero_image_url text,
  add column preview_text    text;
alter table public.newsletters
  drop column if exists content,
  drop column if exists custom_html,
  drop column if exists main_title,
  drop column if exists image_path;
delete from public.newsletters where id = 24;  -- session test row
commit;
```
- [ ] **Step 2 — apply** via MCP `apply_migration` name `newsletters_file_upload_columns`.
- [ ] **Step 3 — write `<v>_newsletters_storage_bucket.sql`:**
```sql
insert into storage.buckets (id, name, public)
values ('newsletters', 'newsletters', true)
on conflict (id) do nothing;

create policy "newsletters bundle public read"
  on storage.objects for select
  using (bucket_id = 'newsletters');

create policy "newsletters bundle service write"
  on storage.objects for all to service_role
  using (bucket_id = 'newsletters')
  with check (bucket_id = 'newsletters');
```
- [ ] **Step 4 — apply** name `newsletters_storage_bucket`. Verify: `select id, public from storage.buckets where id='newsletters';`
- [ ] **Step 5 — realign** both local filenames to their remote versions (`list_migrations`), `git mv`.
- [ ] **Step 6 — edit `types.ts`** `newsletters` block (Row/Insert/Update): remove `content`, `custom_html`, `main_title`, `image_path`; add `bundle_path: string | null`, `web_url: string | null`, `email_subject: string | null`, `hero_image_url: string | null`, `preview_text: string | null` (Insert/Update variants `?`).
- [ ] **Step 7 — verify** `npx tsc -p tsconfig.json --noEmit`. Expect errors in `useAdminManagement.ts` / `NewslettersTab.tsx` referencing dropped cols — those are fixed in Tasks 5–6. If any OTHER file errors, note it.
- [ ] **Step 8 — commit** `git add supabase/migrations/<v>_newsletters_file_upload_columns.sql supabase/migrations/<v>_newsletters_storage_bucket.sql src/integrations/supabase/types.ts && git commit -m "feat(db): newsletters file-upload columns + storage bucket"`

---

## Task 2: `newsletterTeaserEmailHtml()` template

**Files:** modify `supabase/functions/_shared/emailTemplate.ts`

**Produces:**
```ts
export function newsletterTeaserEmailHtml(opts: {
  subject: string;
  heroImageUrl: string | null;
  previewText: string;
  webUrl: string;
}): string
```

- [ ] **Step 1 — append the function** to `emailTemplate.ts`. Table-based, inline styles, RTL, email-safe. No `<script>`, no `<style>` blocks, no fl/grid. Structure:
```ts
export function newsletterTeaserEmailHtml(opts: {
  subject: string; heroImageUrl: string | null; previewText: string; webUrl: string;
}): string {
  const { subject, heroImageUrl, previewText, webUrl } = opts;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;padding:24px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr><td align="center" style="padding:10px 20px;font-size:12px;color:#6b7280">
        <a href="${esc(webUrl)}" style="color:#6b7280">לא רואים את המייל כמו שצריך? צפייה בדפדפן</a>
      </td></tr>
      <tr><td align="center" style="padding:8px 20px 4px;font-size:16px;font-weight:bold;color:#2563eb">קופון מאסטר</td></tr>
      ${heroImageUrl ? `<tr><td><img src="${esc(heroImageUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto"></td></tr>` : ""}
      <tr><td style="padding:24px 28px 8px"><h1 style="margin:0;font-size:22px;color:#111827">${esc(subject)}</h1></td></tr>
      <tr><td style="padding:0 28px 20px;font-size:15px;line-height:1.7;color:#374151">${esc(previewText)}</td></tr>
      <tr><td align="center" style="padding:8px 28px 32px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#2563eb;border-radius:10px">
          <a href="${esc(webUrl)}" style="display:inline-block;padding:13px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold">לצפייה המלאה</a>
        </td></tr></table>
      </td></tr>
    </table>
  </td></tr></table>
</div>`;
}
```
- [ ] **Step 2 — unit test** `src/lib/newsletterTeaser.test.ts`? — NO, it's a Deno file. Instead add `supabase/functions/_shared/emailTemplate.test.ts` run under vitest if the repo already runs `_shared` tests; otherwise assert inline in `e2e-newsletter.mjs` (Task 9). Check: does `vitest.config.mts` include `supabase/`? If yes, write:
```ts
import { describe, it, expect } from "vitest";
import { newsletterTeaserEmailHtml } from "./emailTemplate";
describe("newsletterTeaserEmailHtml", () => {
  it("links to the web url and omits script", () => {
    const html = newsletterTeaserEmailHtml({ subject: "כותרת", heroImageUrl: "https://x/h.png", previewText: "פסקה", webUrl: "https://x/full" });
    expect(html).toContain("https://x/full");
    expect(html).toContain("https://x/h.png");
    expect(html).not.toContain("<script");
    expect(html.length).toBeLessThan(40000);
  });
  it("survives a null hero", () => {
    expect(() => newsletterTeaserEmailHtml({ subject: "a", heroImageUrl: null, previewText: "b", webUrl: "https://x" })).not.toThrow();
  });
});
```
If `vitest.config.mts` does NOT cover `supabase/`, skip this step and rely on Task 9.
- [ ] **Step 3 — commit** `git add supabase/functions/_shared/emailTemplate.ts <test if written> && git commit -m "feat(edge): newsletter teaser email template"`

---

## Task 3: `newsletter-upload` edge function

**Files:** create `supabase/functions/newsletter-upload/index.ts`

**Consumes:** `newsletters` new columns (Task 1). **Produces:** endpoint, admin-gated, body `{ newsletter_id, filename, content_base64 }`, returns `{ web_url, email_subject, hero_image_url, preview_text, file_count }`.

- [ ] **Step 1 — write the function:**
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BlobReader, ZipReader, Uint8ArrayWriter } from "https://deno.land/x/zipjs@v2.7.45/index.js";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const MAX_BYTES = 5 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
  const { data: isAdmin } = await caller.rpc("is_app_admin");
  if (!isAdmin) return json({ error: "אין הרשאה" }, 403);

  const { newsletter_id, filename, content_base64 } = await req.json().catch(() => ({}));
  if (!newsletter_id || !filename || !content_base64) return json({ error: "missing fields" }, 400);

  const bytes = Uint8Array.from(atob(content_base64), (c) => c.charCodeAt(0));
  if (bytes.byteLength > MAX_BYTES) return json({ error: "הקובץ גדול מ-5MB" }, 413);

  let files: { path: string; bytes: Uint8Array }[];
  if (filename.toLowerCase().endsWith(".zip")) {
    const zip = new ZipReader(new BlobReader(new Blob([bytes])));
    const entries = (await zip.getEntries()).filter((e) => !e.directory);
    files = await Promise.all(entries.map(async (e) => ({ path: e.filename.replace(/^\/+/, ""), bytes: await e.getData!(new Uint8ArrayWriter()) })));
    await zip.close();
  } else if (filename.toLowerCase().endsWith(".html")) {
    files = [{ path: "index.html", bytes }];
  } else {
    return json({ error: "רק ZIP או HTML" }, 400);
  }

  const entry = files.find((f) => f.path === "index.html") || files.find((f) => f.path.toLowerCase().endsWith(".html"));
  if (!entry) return json({ error: "אין קובץ HTML בחבילה" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const base = `${newsletter_id}/`;
  const publicBase = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/newsletters/${base}`;

  // clear a previous bundle
  const { data: existing } = await admin.storage.from("newsletters").list(String(newsletter_id));
  if (existing?.length) await admin.storage.from("newsletters").remove(existing.map((o) => base + o.name));

  for (const f of files) {
    if (f === entry) continue;
    const ct = f.path.endsWith(".css") ? "text/css" : f.path.endsWith(".js") ? "text/javascript"
      : f.path.match(/\.(png|jpe?g|gif|webp|svg)$/i) ? `image/${f.path.split(".").pop()!.replace("jpg", "jpeg").replace("svg", "svg+xml")}` : "application/octet-stream";
    await admin.storage.from("newsletters").upload(base + f.path, f.bytes, { contentType: ct, upsert: true });
  }

  let html = new TextDecoder().decode(entry.bytes);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const subject = (doc?.querySelector("title")?.textContent || doc?.querySelector("h1")?.textContent || "").trim();
  const firstImg = doc?.querySelector("img")?.getAttribute("src") || null;
  const firstP = (doc?.querySelector("p")?.textContent || "").trim().slice(0, 200);

  html = html.replace(/(src|href)=("|')(?!https?:|data:|mailto:|tel:|#)([^"']+)\2/gi,
    (_m, a, q, p) => `${a}=${q}${publicBase}${p.replace(/^\.?\//, "")}${q}`);
  const heroUrl = firstImg && !/^(https?:|data:)/i.test(firstImg) ? publicBase + firstImg.replace(/^\.?\//, "") : firstImg;

  await admin.storage.from("newsletters").upload(base + "index.html", new TextEncoder().encode(html), { contentType: "text/html", upsert: true });

  const { data: current } = await admin.from("newsletters").select("email_subject,hero_image_url,preview_text").eq("id", newsletter_id).single();
  const patch = {
    bundle_path: base + "index.html",
    web_url: publicBase + "index.html",
    email_subject: current?.email_subject || subject,
    hero_image_url: current?.hero_image_url || heroUrl,
    preview_text: current?.preview_text || firstP,
  };
  await admin.from("newsletters").update(patch).eq("id", newsletter_id);

  return json({ ...patch, file_count: files.length });
});
```
- [ ] **Step 2 — deploy** via MCP `deploy_edge_function` name `newsletter-upload`, `verify_jwt: true`, one file.
- [ ] **Step 3 — smoke test** from SQL is not possible (needs admin JWT + multipart). Defer full test to Task 9; here just confirm deploy succeeded and `GET` without auth → 401.
- [ ] **Step 4 — commit** `git add supabase/functions/newsletter-upload/index.ts && git commit -m "feat(edge): newsletter-upload — host a design bundle, extract teaser fields"`

---

## Task 4: switch `send-emails` + `newsletter-preview` to the teaser

**Files:** modify `supabase/functions/send-emails/index.ts`, `supabase/functions/newsletter-preview/index.ts`

- [ ] **Step 1 — `send-emails` `handleNewsletter`:** change the select to `id,title,email_subject,hero_image_url,preview_text,web_url`; after the `if (!nl)` guard add `if (!nl.web_url) return jsonResponse({ error: 'לניוזלטר אין קובץ עיצוב' }, 400);`; import `newsletterTeaserEmailHtml` from `../_shared/emailTemplate.ts`; replace the per-user html line with:
```ts
const html = await wrapMarketingEmail(
  newsletterTeaserEmailHtml({
    subject: nl.email_subject || nl.title,
    heroImageUrl: nl.hero_image_url,
    previewText: nl.preview_text || "",
    webUrl: nl.web_url,
  }),
  u.public_id, u.email,
);
const ok = await sendEmail(u.email, nl.email_subject || nl.title, html, await buildUnsubscribeHeaders(u.public_id, u.email));
```
- [ ] **Step 2 — `newsletter-preview`:** select `title,email_subject,hero_image_url,preview_text,web_url`; `if (!nl.web_url) return json({ error: "לניוזלטר אין קובץ עיצוב" }, 400);`; inline a copy of the teaser builder OR import it — `newsletter-preview` currently has no `_shared` imports; add `import { newsletterTeaserEmailHtml } from "../_shared/emailTemplate.ts";` and bundle `emailTemplate.ts` on deploy. Send `newsletterTeaserEmailHtml({...})` as `htmlContent`, subject `[תצוגה מקדימה] ${nl.email_subject || nl.title}`.
- [ ] **Step 3 — redeploy `newsletter-preview`** (2 files: index.ts + ../_shared/emailTemplate.ts).
- [ ] **Step 4 — redeploy `send-emails`** — bundle ALL its local deps: `index.ts` + `_shared/`: `cors.ts`, `auth.ts`, `unsubscribe.ts`, `appLinks.ts`, `ssrf.ts`, `emailTemplate.ts`. Read each verbatim and pass in the `files` array with matching `../_shared/x.ts` names.
- [ ] **Step 5 — commit** `git add supabase/functions/send-emails/index.ts supabase/functions/newsletter-preview/index.ts && git commit -m "feat(edge): newsletter sends render the teaser template"`

---

## Task 5: `useAdminManagement` + `useNewsletterUpload`

**Files:** modify `src/hooks/useAdminManagement.ts`, `src/lib/tableColumns.ts`; create `src/hooks/useNewsletterUpload.ts`; modify `package.json` (add `expo-document-picker`)

- [ ] **Step 1 — install** `npx expo install expo-document-picker`. Run `npm run size`; record the delta.
- [ ] **Step 2 — `tableColumns.ts`** `NEWSLETTERS_COLUMNS`: set to `'id,created_at,created_by,title,newsletter_type,show_telegram_button,is_published,is_sent,sent_count,bundle_path,web_url,email_subject,hero_image_url,preview_text'`.
- [ ] **Step 3 — `useAdminManagement.ts`:** `useUpsertNewsletter` insert body drops `content`/`main_title`; keeps `title,newsletter_type,created_by,is_published:false,is_sent:false,sent_count:0,show_telegram_button`. `useDeleteNewsletter` — after the delete, best-effort clear Storage:
```ts
await supabase.storage.from("newsletters").list(String(id)).then(({ data }) => {
  if (data?.length) return supabase.storage.from("newsletters").remove(data.map((o) => `${id}/${o.name}`));
}).catch(() => {});
```
- [ ] **Step 4 — `useNewsletterUpload.ts`:**
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

export function useNewsletterUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (newsletterId: number) => {
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/zip", "text/html"], copyToCacheDirectory: true });
      if (res.canceled) return null;
      const asset = res.assets[0];
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const { data, error } = await supabase.functions.invoke("newsletter-upload", {
        body: { newsletter_id: newsletterId, filename: asset.name, content_base64: b64 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { web_url: string; email_subject: string; hero_image_url: string | null; preview_text: string };
    },
    onSuccess: (d) => { if (d) { notify.success("הקובץ הועלה"); qc.invalidateQueries({ queryKey: ["newsletters"] }); } },
    onError: (e: any) => notify.error("שגיאה בהעלאה", e.message),
  });
}
```
- [ ] **Step 5 — verify** `tsc` clean for these files.
- [ ] **Step 6 — commit** `git add package.json package-lock.json src/hooks/useAdminManagement.ts src/hooks/useNewsletterUpload.ts src/lib/tableColumns.ts && git commit -m "feat(admin): newsletter upload hook + column list"`

---

## Task 6: `NewslettersTab` file-upload UI

**Files:** modify `src/screens/admin/NewslettersTab.tsx`

- [ ] **Step 1 — rewrite the editor modal.** Remove the `content`, `custom_html`, `main_title`, `newsletter_type` fields. The `Draft` type becomes `Partial<Newsletter> & { id?: number; title: string }` with the new columns. Modal contents:
  - `title` field (label: "כותרת פנימית (לרשימה)", required)
  - "העלה קובץ עיצוב (ZIP או HTML)" button → `useNewsletterUpload().mutate(editing.id)` — only enabled once the row is saved (has an id). For a brand-new draft, show "שמור קודם כדי להעלות קובץ".
  - after `web_url` exists: `email_subject` (TextInput), `hero_image_url` (small `<Image>` preview + read-only URL), `preview_text` (multiline TextInput) — all bound to `editing`, saved via `useUpsertNewsletter`.
  - "צפייה בדף המלא" → `Linking.openURL(editing.web_url)`.
  - `show_telegram_button` Switch (keep).
  - keep the note: "שליחה לא מתבצעת מכאן."
- [ ] **Step 2 — list card:** show a "מוכן לשליחה" / "חסר קובץ עיצוב" badge based on `item.web_url`.
- [ ] **Step 3 — verify** `tsc` clean, `vitest` green.
- [ ] **Step 4 — commit** `git add src/screens/admin/NewslettersTab.tsx && git commit -m "feat(admin): newsletter tab — upload a design file instead of pasting HTML"`

---

## Task 7: e2e + verification + docs

**Files:** create `scripts/e2e-newsletter.mjs`; modify session doc

- [ ] **Step 1 — `e2e-newsletter.mjs`** (model on `e2e-referral.mjs`, `pg` + REST + a service-key or admin-JWT fetch). Build a tiny ZIP in-script (`fflate` or a hand-rolled store-only zip, or just send a single `.html`). Cases:
  1. insert a `newsletters` row (title only) → id.
  2. `POST /functions/v1/newsletter-upload` with `{ newsletter_id, filename: "n.html", content_base64 }` where the HTML has `<title>`, `<img src="pic.png">` (for `.html` single-file, hero stays relative → becomes Storage URL), `<p>`.
  3. assert the row now has `web_url`, `email_subject`, `preview_text`.
  4. `GET web_url` → 200, `content-type: text/html`, body contains the rewritten absolute `src`.
  5. `POST /functions/v1/newsletter-preview { newsletter_id, to: "itayk93@gmail.com" }` → `ok:true`; response/email references `web_url`.
  6. non-admin upload → 403.
  7. cleanup: delete row, `storage.remove` the bundle.
- [ ] **Step 2 — run** `node scripts/e2e-newsletter.mjs` (needs env). If env missing, document required vars in the header and note skipped.
- [ ] **Step 3 — full verify:** `tsc` clean · `vitest` green · `npm run size` within budget (report `expo-document-picker` delta) · MCP `get_advisors` security — confirm no new findings beyond an expected `newsletters` storage policy note.
- [ ] **Step 4 — confirm dropped columns gone:**
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='newsletters' order by ordinal_position;
```
Expect: no `content`, `custom_html`, `main_title`, `image_path`; yes `bundle_path`, `web_url`, `email_subject`, `hero_image_url`, `preview_text`.
- [ ] **Step 5 — append "Phase 4" to `docs/SESSION_2026-08-29_DB_UNUSED_COLUMNS_AUDIT.md`:** file-upload newsletters, 4 columns dropped, teaser model, new bucket + functions, the expo-document-picker size delta.
- [ ] **Step 6 — commit + push** `git add scripts/e2e-newsletter.mjs && git add -f docs/SESSION_2026-08-29_DB_UNUSED_COLUMNS_AUDIT.md && git commit -m "test(newsletter): e2e upload→host→teaser; docs Phase 4" && git push origin main`

---

## Self-Review

**Spec coverage:**
- §3.1 schema → Task 1 ✓ · §3.2 bucket → Task 1 ✓ · §3.3 newsletter-upload → Task 3 ✓ · §3.4 teaser template → Task 2 ✓ · §3.5 send changes → Task 4 ✓ · §3.6 tab → Tasks 5–6 ✓ · §3.7 migrations → Task 1 ✓ · §6 tests → Tasks 2,7 ✓ · §8 delete-cleans-storage risk → Task 5 Step 3 ✓ · §9 done-definition → Task 7 ✓

**Placeholder scan:** `<v>` = migration version, resolved at apply (Global Constraints). zip-js / deno-dom versions are pinned (`@v2.7.45`, `@v0.1.45`) — if a pin 404s at deploy, bump to the latest tag and note it. Task 2 Step 2 is conditional on whether `vitest.config.mts` covers `supabase/` — a real check, not a placeholder.

**Type consistency:** `newsletterTeaserEmailHtml` opts (Task 2) = the object built in Task 4 Step 1 and Task 4 Step 2: `{subject, heroImageUrl, previewText, webUrl}`. `useNewsletterUpload` return type = `newsletter-upload` response (Task 3): `{web_url, email_subject, hero_image_url, preview_text}` (+ `file_count`). `NEWSLETTERS_COLUMNS` (Task 5) lists exactly the surviving + new columns from Task 1.

---

## Execution Handoff

Inline execution (executing-plans), batched by task with a verify gate after each. The user asked for full E2E.
