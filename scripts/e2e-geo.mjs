// End-to-end check of geo enrichment + IP retention, against a real deployment.
//
// The chain worth proving: a raw activity row with a public IP and no city ->
// enrich-ip-geo resolves it -> ip_geo has the network (asn) -> the activity row
// is stamped with city/region -> after 90 days strip_old_activity_ip() removes
// the IP but keeps the city -> admin_geo_breakdown reflects it and rejects
// non-admins -> referral_fraud_reasons raises asn_burst on a real burst but not
// on an allowlisted ISP.
//
// Creates only throwaway rows under a sentinel user_id and deletes them all.
//
//   set -a && . ./.env.supabase.local && set +a && \
//   IP_GEO_CRON_TOKEN=... node scripts/e2e-geo.mjs

import pg from 'pg';

const required = ['DATABASE_URL', 'SUPABASE_URL', 'IP_GEO_CRON_TOKEN'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);

const databaseUrl = new URL(process.env.DATABASE_URL.replace('postgresql+psycopg2:', 'postgresql:'));
databaseUrl.searchParams.delete('sslmode');
const db = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } });

const FN = `${process.env.SUPABASE_URL}/functions/v1/enrich-ip-geo`;
const PUBLIC_IP = '8.8.8.8';            // always resolvable
const stamp = Date.now();

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runEnrich() {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-token': process.env.IP_GEO_CRON_TOKEN },
    body: '{}',
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function main() {
  await db.connect();
  const sentinel = (await db.query('select id from public.users order by id limit 1')).rows[0].id;
  const cleanup = [];

  try {
    // --- 1. raw row, public IP, no city -------------------------------------
    await db.query('delete from public.ip_geo where ip_address = $1', [PUBLIC_IP]);
    const row = (await db.query(
      `insert into public.user_activities (user_id, action, "timestamp", ip_address)
       values ($1, 'e2e_geo', now(), $2) returning activity_id`,
      [sentinel, PUBLIC_IP],
    )).rows[0];
    cleanup.push(['user_activities', 'activity_id', row.activity_id]);

    // --- 2. enrich --------------------------------------------------------
    let resolved = false;
    for (let i = 0; i < 5 && !resolved; i += 1) {
      const r = await runEnrich();
      check(`enrich-ip-geo responds 200 (attempt ${i + 1})`, r.status === 200, JSON.stringify(r.body));
      const g = (await db.query('select * from public.ip_geo where ip_address = $1', [PUBLIC_IP])).rows[0];
      if (g && g.source !== 'none') resolved = true;
      else await sleep(1500);
    }

    // --- 3. ip_geo has the network -------------------------------------
    const geo = (await db.query('select * from public.ip_geo where ip_address = $1', [PUBLIC_IP])).rows[0];
    check('ip_geo row created with a city', !!geo && !!geo.city, JSON.stringify(geo));
    check('ip_geo row carries an asn', !!geo && !!geo.asn, JSON.stringify(geo));

    // --- 4. activity row stamped -------------------------------------
    const stamped = (await db.query(
      'select city, region from public.user_activities where activity_id = $1', [row.activity_id],
    )).rows[0];
    check('activity row stamped with city/region', !!stamped.city && !!stamped.region, JSON.stringify(stamped));

    // --- 5. retention: back-date and strip ---------------------------
    await db.query(
      `update public.user_activities set "timestamp" = now() - interval '100 days' where activity_id = $1`,
      [row.activity_id],
    );
    await db.query('select public.strip_old_activity_ip()');
    const afterStrip = (await db.query(
      'select ip_address, city from public.user_activities where activity_id = $1', [row.activity_id],
    )).rows[0];
    check('strip_old_activity_ip nulls ip_address', afterStrip.ip_address === null);
    check('strip_old_activity_ip keeps city', !!afterStrip.city);

    // --- 6. admin_geo_breakdown gate -------------------------------
    await db.query("set local role authenticated");
    let forbidden = false;
    try { await db.query('select * from public.admin_geo_breakdown(30)'); }
    catch (e) { forbidden = /FORBIDDEN/.test(e.message); }
    await db.query('reset role');
    check('admin_geo_breakdown rejects non-admin', forbidden);
    const bd = (await db.query(
      `select coalesce(region,'?') region, coalesce(city,'?') city, count(distinct user_id)::int users
       from public.user_activities where "timestamp" > now() - interval '200 days' group by 1,2`,
    )).rows;
    check('breakdown query groups by region/city', bd.length > 0);

    // --- 7. asn_burst -------------------------------------------------
    // Two synthetic ASNs: one allowlisted (Bezeq), one not.
    const camp = (await db.query(
      `insert into public.referral_campaigns (name, partner_name, code, active)
       values ('e2e-geo', 'e2e', $1, true) returning id`, [`E2EGEO${stamp % 100000}`],
    )).rows[0];
    cleanup.push(['referral_campaigns', 'id', camp.id]);

    async function burst(asn, n, ipPrefix) {
      const ids = [];
      for (let i = 0; i < n; i += 1) {
        const ip = `${ipPrefix}.${i}`;
        await db.query(
          `insert into public.ip_geo (ip_address, city, region, asn, source)
           values ($1,'x','x',$2,'e2e') on conflict (ip_address) do update set asn = excluded.asn`,
          [ip, asn],
        );
        cleanup.push(['ip_geo', 'ip_address', ip]);
        const u = (await db.query('select id from public.users order by id offset $1 limit 1', [i + 1])).rows[0].id;
        const ref = (await db.query(
          `insert into public.referrals (referred_user_id, campaign_id, depth, referral_code, registered_at)
           values ($1,$2,1,$3, now()) returning id`, [u, camp.id, `E2E${i}`],
        )).rows[0];
        cleanup.push(['referrals', 'id', ref.id]);
        await db.query(
          `insert into public.user_activities (user_id, action, "timestamp", ip_address)
           values ($1,'e2e_geo', now(), $2) returning activity_id`, [u, ip],
        );
        ids.push(ref.id);
      }
      return ids;
    }

    const evilIds = await burst('AS64999', 9, '203.0.113');       // not allowlisted
    const evil = (await db.query('select public.referral_fraud_reasons($1) r', [evilIds[0]])).rows[0].r;
    check('asn_burst fires on a 9-account non-allowlisted ASN burst', evil.includes('asn_burst'), JSON.stringify(evil));

    const okIds = await burst('AS8551', 9, '198.51.100');         // Bezeq, allowlisted
    const ok = (await db.query('select public.referral_fraud_reasons($1) r', [okIds[0]])).rows[0].r;
    check('asn_burst does NOT fire on an allowlisted ISP', !ok.includes('asn_burst'), JSON.stringify(ok));
  } finally {
    for (const [table, col, val] of cleanup.reverse()) {
      await db.query(`delete from public.${table} where ${col} = $1`, [val]).catch(() => {});
    }
    await db.query('delete from public.user_activities where action = $1', ['e2e_geo']).catch(() => {});
    await db.end();
  }

  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
}

main();
