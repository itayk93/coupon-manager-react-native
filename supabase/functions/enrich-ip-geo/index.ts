// Supabase Edge Function: enrich-ip-geo
//
// Triggered by pg_cron (trigger_enrich_ip_geo -> net.http_post) every 15 min.
// Takes a batch of IPs that appear in user_activities but are not yet in the
// ip_geo cache, resolves each to a location, and:
//   1. upserts the ip_geo cache row (city/region/isp/asn)
//   2. stamps city/region onto the matching user_activities rows, so the
//      location survives when ip_address is nulled at 90 days.
//
// Env:
//   IP_GEO_CRON_TOKEN  - shared with the pg_cron job (Vault: ip_geo_cron_token)
//   IPINFO_TOKEN       - optional; if set, ipinfo.io is preferred over ipwho.is

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveIp } from "../_shared/ipGeo.ts";

const BATCH = 40;
const PACE_MS = 150;

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

/** pg_cron has no JWT; it carries a token authorising exactly this call. */
function isCronCall(req: Request): boolean {
  const expected = Deno.env.get("IP_GEO_CRON_TOKEN");
  const presented = req.headers.get("x-cron-token");
  if (!expected || !presented || expected.length !== presented.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ presented.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (!isCronCall(req)) return new Response("forbidden", { status: 403 });

  const db = admin();
  const { data: pending, error } = await db.rpc("ip_geo_pending", { p_limit: BATCH });
  if (error) {
    console.error("[enrich-ip-geo] ip_geo_pending failed:", error.message);
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }

  const rows: { ip_address: string }[] = pending ?? [];
  let resolved = 0;
  let failed = 0;

  for (const { ip_address: ip } of rows) {
    const geo = await resolveIp(ip);
    const now = new Date().toISOString();

    if (!geo) {
      await db.from("ip_geo").upsert({
        ip_address: ip,
        source: "none",
        lookup_failed: true,
        resolved_at: now,
      });
      failed++;
      continue;
    }

    await db.from("ip_geo").upsert({
      ip_address: ip,
      city: geo.city,
      region: geo.region,
      country_code: geo.country_code,
      isp: geo.isp,
      asn: geo.asn,
      source: geo.source,
      lookup_failed: false,
      resolved_at: now,
    });

    // Fill every activity row for this IP that has no city yet, in one statement.
    await db
      .from("user_activities")
      .update({ city: geo.city, region: geo.region })
      .eq("ip_address", ip)
      .is("city", null);

    resolved++;
    await new Promise((r) => setTimeout(r, PACE_MS));
  }

  console.log(`[enrich-ip-geo] resolved=${resolved} failed=${failed} batch=${rows.length}`);
  return Response.json({ resolved, failed, skipped: rows.length - resolved - failed });
});
