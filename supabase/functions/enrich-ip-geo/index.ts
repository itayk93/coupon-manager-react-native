// Supabase Edge Function: enrich-ip-geo
//
// Triggered by pg_cron (trigger_enrich_ip_geo -> net.http_post) every 15 min.
// Resolves IPs seen in user_activities but not yet in ip_geo, upserts the cache
// row, and stamps city/region onto the activity rows so the location survives
// when ip_address is nulled at 90 days.
//
// Auth: the cron sends x-cron-token; the expected value lives only in the
// Vault (secret `ip_geo_cron_token`) and is read here via the service-role
// client, so no edge secret is required. Optional env: IPINFO_TOKEN.

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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const db = admin();

  const presented = req.headers.get("x-cron-token") ?? "";
  const { data: expected } = await db.rpc("ip_geo_cron_token");
  if (!expected || !timingSafeEqual(presented, expected)) {
    return new Response("forbidden", { status: 403 });
  }

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
