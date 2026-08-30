# Geo Analytics + Managed IP Retention — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans or subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Auto-fill `city`/`region` on activity rows from a free IP-geolocation service, expose a city/region admin breakdown, add an ASN-burst referral-fraud signal, and drop `user_activities` IP addresses after 90 days — while removing five dead columns.

**Architecture:** A value-keyed `ip_geo` cache table (IP → city/region/isp/asn). A pg_cron-triggered edge function `enrich-ip-geo` resolves unknown IPs via `ipwho.is` (primary, no key) or `ipinfo.io` (if `IPINFO_TOKEN` vault secret is set), upserts the cache, and **stamps `city`/`region` onto the activity rows** so history survives IP deletion. A pure-SQL daily cron nulls IP + `extra_metadata` past 90 days. A `SECURITY DEFINER` RPC serves the admin breakdown with no join. `referral_fraud_reasons()` gains an `asn_burst` signal.

**Tech Stack:** Supabase Postgres 15, pg_cron + pg_net + supabase_vault, Deno edge functions, React Native + expo-router + @tanstack/react-query, vitest, Node e2e scripts.

## Global Constraints

- Commit straight to `main`, no branches/PRs. No AI-authorship trailers.
- `git add <explicit paths>` — never `-A` (parallel uncommitted work is common here).
- JS bundle ≤ 10MB, packed assets ≤ 6MB (`npm run size`). Any local device storage needs an enforced cap — N/A here, all server-side.
- Migrations: local file in `supabase/migrations/`, applied via Supabase MCP `apply_migration`, local filename realigned to the remote version string afterward.
- Edge functions cannot have secrets set by the worker — `IPINFO_TOKEN` is optional; `ipwho.is` must work with zero config.
- RPC admin gate: `if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;`
- Types file `src/integrations/supabase/types.ts` is edited surgically (remove/add table+column blocks in Row/Insert/Update), NOT regenerated — the generator drifts on RPC param types.
- Hebrew UI copy. Currency via `formatIls`/`IlsAmount` (not relevant here).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/<v>_create_ip_geo.sql` | `ip_geo` table, RLS, indexes | create |
| `supabase/migrations/<v>_backfill_ip_geo.sql` | seed `ip_geo` from legacy `user_activities` rows | create |
| `supabase/migrations/<v>_user_activities_geo_cleanup.sql` | `idx_user_activities_ip`; DROP `duration,browser,country,lat,timezone` | create |
| `supabase/migrations/<v>_admin_geo_breakdown.sql` | `admin_geo_breakdown(int)` RPC + GRANT | create |
| `supabase/migrations/<v>_referral_fraud_asn_burst.sql` | `CREATE OR REPLACE referral_fraud_reasons` | create |
| `supabase/migrations/<v>_ip_geo_cron.sql` | `strip_old_activity_ip()`, `reset_failed_ip_lookups()`, `trigger_enrich_ip_geo()`, 3 cron jobs, vault secret rows | create |
| `supabase/functions/enrich-ip-geo/index.ts` | resolve unknown IPs, upsert cache, stamp rows | create |
| `supabase/functions/_shared/ipGeo.ts` | provider calls + `org` → `{asn,isp}` parser | create |
| `src/integrations/supabase/types.ts` | drop 5 cols from `user_activities`, add `ip_geo` block, add RPC | modify |
| `src/lib/tableColumns.ts` | `USER_ACTIVITIES_COLUMNS` if referenced (check) | modify (maybe) |
| `src/hooks/useGeoAnalytics.ts` | react-query hook over the RPC | create |
| `src/screens/admin/GeoAnalyticsTab.tsx` | the tab UI | create |
| `src/screens/admin/AdminDashboardScreen.tsx` | wire `"geo"` into `AdminTab`/`TAB_KEYS`/render | modify |
| `src/screens/content/PrivacyScreen.tsx` | new §4 + soften §2 | modify |
| `src/hooks/useConsent.ts` | delete `user_activities` on account deletion | modify |
| `scripts/e2e-geo.mjs` | end-to-end: enrich → stamp → breakdown → retention → asn_burst | create |
| `docs/SESSION_2026-08-29_DB_UNUSED_COLUMNS_AUDIT.md` | append Phase 3 | modify |

---

## Task 1: `ip_geo` table + backfill

**Files:** create `supabase/migrations/<v>_create_ip_geo.sql`, `<v>_backfill_ip_geo.sql`

**Produces:** table `public.ip_geo(ip_address text pk, city text, region text, country_code text, isp text, asn text, source text not null, resolved_at timestamptz not null default now(), lookup_failed boolean not null default false)`.

- [ ] **Step 1 — write `create_ip_geo.sql`:**
```sql
create table public.ip_geo (
  ip_address    text primary key,
  city          text,
  region        text,
  country_code  text,
  isp           text,
  asn           text,
  source        text not null,
  resolved_at   timestamptz not null default now(),
  lookup_failed boolean not null default false
);
alter table public.ip_geo enable row level security;
-- no policies: service_role bypasses RLS; authenticated/anon get nothing.
create index idx_ip_geo_asn on public.ip_geo (asn) where asn is not null;
create index idx_ip_geo_stale on public.ip_geo (resolved_at) where not lookup_failed;
```
- [ ] **Step 2 — apply** via MCP `apply_migration` name `create_ip_geo`.
- [ ] **Step 3 — write `backfill_ip_geo.sql`:**
```sql
insert into public.ip_geo (ip_address, city, region, country_code, source, resolved_at)
select distinct on (ip_address)
       ip_address, city, region, country_code, 'legacy', now()
from public.user_activities
where ip_address is not null and city is not null
order by ip_address, "timestamp" desc
on conflict (ip_address) do nothing;
```
- [ ] **Step 4 — apply** name `backfill_ip_geo`. Verify: `select count(*), count(*) filter (where source='legacy') from ip_geo;` expect a few hundred rows.
- [ ] **Step 5 — realign local filenames** to the two remote version strings (`list_migrations`), `git mv`.
- [ ] **Step 6 — commit** `git add supabase/migrations/<v>_create_ip_geo.sql supabase/migrations/<v>_backfill_ip_geo.sql && git commit -m "feat(db): ip_geo cache table + legacy backfill"`

---

## Task 2: `user_activities` cleanup migration

**Files:** create `supabase/migrations/<v>_user_activities_geo_cleanup.sql`; modify `src/integrations/supabase/types.ts`

**Consumes:** nothing. **Produces:** `user_activities` has 11 columns; index `idx_user_activities_ip`.

- [ ] **Step 1 — confirm no code reads the doomed columns** beyond the select-all constant:
```bash
grep -rIn "\.duration\b\|\.browser\b\|activity.*\.country\b\|\.timezone\b\|\.lat\b" src --include='*.ts' --include='*.tsx' | grep -iv "coupon_places\|regionRef\|latitude\|writingDirection\|maps"
```
Expected: no hits tied to `user_activities`/`UserActivity`. (`lat` on `coupon_places` is fine.)
- [ ] **Step 2 — write migration:**
```sql
begin;
create index if not exists idx_user_activities_ip
  on public.user_activities (ip_address) where ip_address is not null;
alter table public.user_activities
  drop column if exists duration,
  drop column if exists browser,
  drop column if exists country,
  drop column if exists lat,
  drop column if exists timezone;
commit;
```
- [ ] **Step 3 — apply** name `user_activities_geo_cleanup`; realign filename; `git mv`.
- [ ] **Step 4 — edit `types.ts`:** in the `user_activities` block (Row/Insert/Update) delete the `duration`, `browser`, `country`, `lat`, `timezone` lines. Add an `ip_geo` table block (Row/Insert/Update/Relationships:[]) mirroring the schema from Task 1.
- [ ] **Step 5 — verify** `npx tsc -p tsconfig.json --noEmit` → 0 errors. `npx vitest run` → green.
- [ ] **Step 6 — commit** `git add supabase/migrations/<v>_user_activities_geo_cleanup.sql src/integrations/supabase/types.ts && git commit -m "feat(db): drop 5 dead user_activities columns, index ip_address"`

---

## Task 3: `_shared/ipGeo.ts` provider module

**Files:** create `supabase/functions/_shared/ipGeo.ts`

**Produces:**
```ts
export type IpGeo = { city: string|null; region: string|null; country_code: string|null; isp: string|null; asn: string|null; source: 'ipinfo'|'ipwho' };
export async function resolveIp(ip: string): Promise<IpGeo | null>;
```

- [ ] **Step 1 — write the module.** `resolveIp` tries `ipinfo.io` only if `Deno.env.get('IPINFO_TOKEN')` is set, else `ipwho.is`; on any non-2xx / throw / `success===false`, falls through to the other; returns `null` if both fail. Parse ipinfo `org` (`"AS#### Name"`) → `asn="AS####"`, `isp="Name"`. ipwho: `connection.asn`→`"AS"+n`, `connection.isp`, `region`, `city`, `country_code`. 4s `AbortController` timeout per call.
```ts
const TIMEOUT = 4000;
async function j(url: string, headers?: Record<string,string>) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), TIMEOUT);
  try { const r = await fetch(url, { headers, signal: c.signal, redirect: 'error' });
        return r.ok ? await r.json() : null; }
  catch { return null; } finally { clearTimeout(t); }
}
function parseOrg(org?: string) {
  const m = /^(AS\d+)\s+(.*)$/.exec(org ?? '');
  return m ? { asn: m[1], isp: m[2] } : { asn: null, isp: org || null };
}
export async function resolveIp(ip: string): Promise<IpGeo | null> {
  const token = Deno.env.get('IPINFO_TOKEN');
  if (token) {
    const d = await j(`https://ipinfo.io/${ip}?token=${token}`);
    if (d && !d.bogon && (d.city || d.region)) {
      const { asn, isp } = parseOrg(d.org);
      return { city: d.city ?? null, region: d.region ?? null, country_code: d.country ?? null, isp, asn, source: 'ipinfo' };
    }
  }
  const w = await j(`https://ipwho.is/${ip}`);
  if (w && w.success !== false && (w.city || w.region)) {
    return { city: w.city ?? null, region: w.region ?? null, country_code: w.country_code ?? null,
             isp: w.connection?.isp ?? null,
             asn: w.connection?.asn ? `AS${w.connection.asn}` : null, source: 'ipwho' };
  }
  return null;
}
```
- [ ] **Step 2 — commit** `git add supabase/functions/_shared/ipGeo.ts && git commit -m "feat(edge): shared IP-geolocation resolver"`

---

## Task 4: `enrich-ip-geo` edge function

**Files:** create `supabase/functions/enrich-ip-geo/index.ts`

**Consumes:** `resolveIp` (Task 3). **Produces:** HTTP endpoint, header `X-Cron-Token` gated; POST body ignored; returns `{resolved, failed, skipped}`.

- [ ] **Step 1 — write the function:**
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveIp } from '../_shared/ipGeo.ts';

const BATCH = 40;
const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(async (req) => {
  if (req.headers.get('X-Cron-Token') !== Deno.env.get('IP_GEO_CRON_TOKEN')) {
    return new Response('forbidden', { status: 403 });
  }
  const db = admin();
  const { data: pending } = await db.rpc('ip_geo_pending', { p_limit: BATCH });
  let resolved = 0, failed = 0;
  for (const { ip_address: ip } of pending ?? []) {
    const geo = await resolveIp(ip);
    if (!geo) {
      await db.from('ip_geo').upsert({ ip_address: ip, source: 'none', lookup_failed: true, resolved_at: new Date().toISOString() });
      failed++; continue;
    }
    await db.from('ip_geo').upsert({ ip_address: ip, ...geo, lookup_failed: false, resolved_at: new Date().toISOString() });
    await db.from('user_activities').update({ city: geo.city, region: geo.region }).eq('ip_address', ip).is('city', null);
    resolved++;
    await new Promise((r) => setTimeout(r, 150));
  }
  return Response.json({ resolved, failed, skipped: (pending?.length ?? 0) - resolved - failed });
});
```
- [ ] **Step 2 — add `ip_geo_pending` RPC** to the Task 1 migration set as a small follow-up migration `<v>_ip_geo_pending.sql` (or fold into Task 6). Definition:
```sql
create function public.ip_geo_pending(p_limit int)
returns table (ip_address text)
language sql security definer set search_path = public, pg_temp as $$
  select distinct ua.ip_address from public.user_activities ua
  where ua.ip_address is not null
    and not exists (select 1 from public.ip_geo g
                    where g.ip_address = ua.ip_address and (not g.lookup_failed))
  limit p_limit;
$$;
revoke all on function public.ip_geo_pending(int) from public, anon, authenticated;
```
- [ ] **Step 3 — deploy** via MCP `deploy_edge_function` (name `enrich-ip-geo`, include both files).
- [ ] **Step 4 — commit** `git add supabase/functions/enrich-ip-geo/index.ts && git commit -m "feat(edge): enrich-ip-geo cron worker"`

---

## Task 5: cron + retention SQL

**Files:** create `supabase/migrations/<v>_ip_geo_cron.sql`

**Consumes:** `enrich-ip-geo` deployed (Task 4). **Produces:** functions `strip_old_activity_ip()`, `reset_failed_ip_lookups()`, `trigger_enrich_ip_geo()`; cron jobs `ip-geo-enrich` (`*/15 * * * *`), `ip-geo-strip` (`0 3 * * *`), `ip-geo-reset-failed` (`0 4 * * 0`).

- [ ] **Step 1 — vault secrets** (MCP `execute_sql`, values from `get_project_url` + a generated token; ask user to confirm token or generate one):
```sql
select vault.create_secret('<https://<ref>.functions.supabase.co/enrich-ip-geo>', 'enrich_ip_geo_function_url');
select vault.create_secret('<random-32>', 'ip_geo_cron_token');
```
Also set the same token as edge secret `IP_GEO_CRON_TOKEN` (ask user — worker cannot set edge secrets).
- [ ] **Step 2 — write migration:**
```sql
create or replace function public.strip_old_activity_ip()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.user_activities
    set ip_address = null, extra_metadata = null
  where "timestamp" < now() - interval '90 days' and ip_address is not null;
  delete from public.ip_geo g
  where g.resolved_at < now() - interval '90 days'
    and not exists (select 1 from public.user_activities ua where ua.ip_address = g.ip_address);
end; $$;

create or replace function public.reset_failed_ip_lookups()
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.ip_geo set lookup_failed = false
  where lookup_failed and resolved_at < now() - interval '7 days';
$$;

create or replace function public.trigger_enrich_ip_geo()
returns void language plpgsql security definer set search_path = public, extensions, vault as $$
declare u text; tok text;
begin
  select decrypted_secret into u from vault.decrypted_secrets where name = 'enrich_ip_geo_function_url' limit 1;
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'ip_geo_cron_token' limit 1;
  if u is null or tok is null then raise exception 'Missing Vault secret for enrich-ip-geo'; end if;
  perform net.http_post(url := u,
    headers := jsonb_build_object('Content-Type','application/json','X-Cron-Token',tok),
    body := '{}'::jsonb, timeout_milliseconds := 8000);
end; $$;

select cron.schedule('ip-geo-enrich', '*/15 * * * *', $$select public.trigger_enrich_ip_geo();$$);
select cron.schedule('ip-geo-strip', '0 3 * * *', $$select public.strip_old_activity_ip();$$);
select cron.schedule('ip-geo-reset-failed', '0 4 * * 0', $$select public.reset_failed_ip_lookups();$$);
```
- [ ] **Step 3 — apply** name `ip_geo_cron`; realign filename.
- [ ] **Step 4 — smoke test:** `select public.trigger_enrich_ip_geo();` then after ~30s `select count(*) from ip_geo where source in ('ipwho','ipinfo');` should be > legacy-only.
- [ ] **Step 5 — commit.**

---

## Task 6: `admin_geo_breakdown` RPC + hook + tab

**Files:** create `supabase/migrations/<v>_admin_geo_breakdown.sql`, `src/hooks/useGeoAnalytics.ts`, `src/screens/admin/GeoAnalyticsTab.tsx`; modify `src/screens/admin/AdminDashboardScreen.tsx`, `src/integrations/supabase/types.ts`

**Consumes:** stamped `city`/`region` (Task 4). **Produces:** `admin_geo_breakdown(p_days int) -> setof(region text, city text, users bigint, events bigint)`; hook `useGeoAnalytics(days: 30|90)`.

- [ ] **Step 1 — migration:**
```sql
create or replace function public.admin_geo_breakdown(p_days integer)
returns table (region text, city text, users bigint, events bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;
  if p_days not in (30, 90) then raise exception 'invalid range'; end if;
  return query
    select coalesce(ua.region, 'לא ידוע'), coalesce(ua.city, 'לא ידוע'),
           count(distinct ua.user_id), count(*)
    from public.user_activities ua
    where ua."timestamp" > now() - (p_days || ' days')::interval
    group by 1, 2 order by 3 desc limit 200;
end; $$;
revoke all on function public.admin_geo_breakdown(int) from public, anon;
grant execute on function public.admin_geo_breakdown(int) to authenticated;
```
- [ ] **Step 2 — apply** name `admin_geo_breakdown`; realign; add RPC signature to `types.ts` `Functions` block.
- [ ] **Step 3 — `useGeoAnalytics.ts`:**
```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type GeoRow = { region: string; city: string; users: number; events: number };
export function useGeoAnalytics(days: 30 | 90) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ["geo_analytics", days],
    enabled: isAdmin,
    queryFn: async (): Promise<GeoRow[]> => {
      const { data, error } = await supabase.rpc("admin_geo_breakdown", { p_days: days });
      if (error) throw error;
      return (data ?? []) as GeoRow[];
    },
  });
}
```
- [ ] **Step 4 — `GeoAnalyticsTab.tsx`:** range toggle (30/90) + a `FlatList`/`ScrollView` table `אזור · עיר · משתמשים · אירועים`, styled with `useAppTheme`/`fonts`/`radii` per the other tabs. Loading + empty states ("אין נתונים בטווח").
- [ ] **Step 5 — wire `AdminDashboardScreen.tsx`:** `AdminTab` union += `"geo"`; `TAB_KEYS` += `"geo"`; tab button `{ key: "geo", label: "גאוגרפיה", icon: <MapPin size={16} /> }` (import `MapPin` from `lucide-react-native`); `{activeTab === "geo" ? <GeoAnalyticsTab /> : null}`.
- [ ] **Step 6 — verify** `tsc` clean, `vitest` green.
- [ ] **Step 7 — commit** `git add supabase/migrations/<v>_admin_geo_breakdown.sql src/hooks/useGeoAnalytics.ts src/screens/admin/GeoAnalyticsTab.tsx src/screens/admin/AdminDashboardScreen.tsx src/integrations/supabase/types.ts && git commit -m "feat(admin): geo analytics tab"`

---

## Task 7: `asn_burst` fraud signal

**Files:** create `supabase/migrations/<v>_referral_fraud_asn_burst.sql`

**Consumes:** `ip_geo.asn` (Task 1), `enrich-ip-geo` populating it (Task 4). **Produces:** `referral_fraud_reasons(bigint)` returns `'asn_burst'` when applicable.

- [ ] **Step 1 — migration** (`CREATE OR REPLACE` the whole function; keep `duplicate_install`, `reciprocal_referral`, `ip_burst` blocks verbatim from the current definition, append):
```sql
  -- asn_burst: many referred users on one ISP/ASN within a day of each other,
  -- catching CGNAT and VPN pools where IPs differ but the network does not.
  -- Large IL residential ISPs are muted: half the country shares those ASNs.
  select count(distinct b.referred_user_id) into n
  from public.referrals a
  join public.user_activities ua_a on ua_a.user_id = a.referred_user_id
  join public.ip_geo geo_a on geo_a.ip_address = ua_a.ip_address
  join public.ip_geo geo_b on geo_b.asn = geo_a.asn
  join public.user_activities ua_b on ua_b.ip_address = geo_b.ip_address
  join public.referrals b on b.referred_user_id = ua_b.user_id
  where a.id = p_referral_id
    and geo_a.asn is not null
    and geo_a.asn <> all (array['AS8551','AS12400','AS1680','AS16116','AS8867','AS9116','AS39737']::text[])
    and b.campaign_id = r.campaign_id
    and abs(extract(epoch from (b.registered_at - r.registered_at))) < 86400;
  if n >= 8 then reasons := reasons || 'asn_burst'; end if;
```
- [ ] **Step 2 — apply** name `referral_fraud_asn_burst`; realign filename.
- [ ] **Step 3 — verify** existing referral e2e still green: `node scripts/e2e-referral.mjs` (needs env — skip if unavailable, note it).
- [ ] **Step 4 — commit.**

---

## Task 8: privacy policy + account-deletion cleanup

**Files:** modify `src/screens/content/PrivacyScreen.tsx`, `src/hooks/useConsent.ts`

- [ ] **Step 1 — `PrivacyScreen.tsx`:** replace §2 body text with:
> "המידע שלך משמש אך ורק לניהול הארנק הדיגיטלי האישי שלך. איננו מוכרים את המידע. איננו משתפים אותו עם צד שלישי, למעט שירותי תשתית חיוניים (אירוח, דוא\"ל, וגזירת עיר/אזור מכתובת IP) הפועלים לפי הוראותינו."
Add §4:
> **4. תיעוד פעילות ומיקום**
> "לשיפור המוצר ולמניעת ניצול לרעה של תוכנית ההפניות אנו רושמים פעולות בסיסיות: מסכים שנצפו, פעולות על קופונים, סוג המכשיר, וכתובת ה-IP. כתובת ה-IP נשמרת עד 90 יום ואז נמחקת. מתוכה נגזרים עיר ואזור כלליים (למשל \"תל אביב\") שאינם מזהים אותך אישית ונשמרים לצורך ניתוח סטטיסטי. לצורך גזירת המיקום כתובת ה-IP נשלחת לשירות geolocation חיצוני; לא נשלח אליו מידע מזהה אחר."
Bump the `sectionHeading` count / keep numbering consistent.
- [ ] **Step 2 — `useConsent.ts`** in `useDeleteAccount` mutationFn, after the `notifications` delete:
```ts
      await supabase.from('user_activities').delete().eq('user_id', user.id);
```
- [ ] **Step 3 — verify** `tsc` clean, `vitest` green.
- [ ] **Step 4 — commit** `git add src/screens/content/PrivacyScreen.tsx src/hooks/useConsent.ts && git commit -m "feat: document activity/IP logging in privacy policy; wipe activity on delete"`

---

## Task 9: e2e script

**Files:** create `scripts/e2e-geo.mjs`

- [ ] **Step 1 — write** a node script modeled on `scripts/e2e-referral.mjs` (same `pg` + REST helpers). Cases:
  1. insert a `user_activities` row with a known public IP, `city=null`.
  2. `POST /functions/v1/enrich-ip-geo` with `X-Cron-Token` → `{resolved>=1}`.
  3. assert `ip_geo` has that IP with non-null `asn`.
  4. assert the activity row now has `city`/`region`.
  5. call `strip_old_activity_ip()` after back-dating the row 100 days → `ip_address IS NULL`, `city` still set.
  6. `admin_geo_breakdown(30)` as admin → row present; as non-admin → 403/error.
  7. seed 8 referred users sharing an `ip_geo.asn` (non-allowlisted) within 24h → `referral_fraud_reasons` includes `asn_burst`; seed on `AS8551` → excluded.
- [ ] **Step 2 — run** `node scripts/e2e-geo.mjs` (needs `SUPABASE_URL`, service key, DB url, cron token in env). If env missing, document the required vars in the script header and note the run was skipped.
- [ ] **Step 3 — commit.**

---

## Task 10: schema-drop verification + docs

- [ ] **Step 1 — confirm the 5 columns are gone:**
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='user_activities' order by ordinal_position;
```
Expected 11: `activity_id,user_id,action,coupon_id,timestamp,ip_address,device,extra_metadata,city,region,country_code`.
- [ ] **Step 2 — advisors:** MCP `get_advisors` security + performance → confirm no NEW findings vs the session baseline (referral SECURITY DEFINER warns are pre-existing; a new `ip_geo` RLS-no-policy INFO is expected and acceptable — it is service-role only by design; note it).
- [ ] **Step 3 — full verify:** `tsc` clean · `vitest` green · `npm run size` within budget.
- [ ] **Step 4 — append "Phase 3" to `docs/SESSION_2026-08-29_DB_UNUSED_COLUMNS_AUDIT.md`:** what was built, the 5 columns dropped, the new cron jobs, provider choice + fallback, retention window, privacy-policy change, verification table.
- [ ] **Step 5 — commit** `git add -f docs/SESSION_2026-08-29_DB_UNUSED_COLUMNS_AUDIT.md && git commit -m "docs: Phase 3 — geo analytics + IP retention" && git push origin main`

---

## Self-Review

**Spec coverage:**
- §3.1 ip_geo → Task 1 ✓ · §3.2 enrich-ip-geo → Tasks 3,4 ✓ · §3.3 schema change → Task 2 ✓ · §3.4 strip-old-ip → Task 5 ✓ · §3.5 asn_burst → Task 7 ✓ · §3.6 admin tab → Task 6 ✓ · §3.7 privacy → Task 8 ✓ · §6 tests → Task 9 ✓ · §7 migration order → Tasks 1,2,5,6,7 ✓ · §9 account-deletion risk → Task 8 ✓ · §10 done-definition → Task 10 ✓
- `reset_failed_ip_lookups` (spec §3.2 "retry after 7 days") → Task 5 ✓
- `ip_geo_pending` RPC — not in spec explicitly; introduced in Task 4 Step 2 to keep the "unknown IP" query server-side and testable. Consistent with the spec's "SELECT DISTINCT ... NOT IN" logic.

**Placeholder scan:** `<v>` = migration version string, resolved at apply time per Global Constraints (documented). `<random-32>` / `<https://<ref>...>` in Task 5 Step 1 are vault values the worker fills from `get_project_url` + a generated token, with a user confirmation for the edge secret — this is a real external-config step, not a code placeholder. ASN allowlist values in Task 7 are concrete (Bezeq 8551, Partner 12400, etc.) with a note they get tuned against real `ip_geo` data.

**Type consistency:** `IpGeo` (Task 3) fields = `ip_geo` columns (Task 1) minus `resolved_at`/`lookup_failed`, plus `source`. `enrich-ip-geo` upsert (Task 4) spreads `...geo` then adds `lookup_failed`,`resolved_at` — matches table. `GeoRow` (Task 6 hook) = `admin_geo_breakdown` return columns (Task 6 migration): `region,city,users,events`. `useGeoAnalytics(days: 30|90)` ↔ RPC `p_days not in (30,90)` guard. Consistent.

---

## Execution Handoff

Inline execution (executing-plans), batched by task with a verify gate after each. The user asked for full E2E now.
