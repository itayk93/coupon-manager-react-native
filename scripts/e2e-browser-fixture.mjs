// Temporary authenticated browser fixture for local visual E2E.
// Usage: `node scripts/e2e-browser-fixture.mjs create|cleanup`.

import crypto from "node:crypto";
import { chmod, readFile, unlink, writeFile } from "node:fs/promises";
import pg from "pg";

const statePath = "/tmp/coupon-master-browser-e2e.json";
const required = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY"];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);

const databaseUrl = new URL(process.env.DATABASE_URL.replace("postgresql+psycopg2:", "postgresql:"));
databaseUrl.searchParams.delete("sslmode");
const db = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } });

async function api(path, init = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function vault(token, body) {
  return api("/functions/v1/coupon-vault", {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function makeUser(instanceId, stamp, number) {
  const user = {
    id: crypto.randomUUID(),
    email: `e2e+browser-${stamp}-${number}@itaykarkason.com`,
    password: `E2e-${crypto.randomBytes(18).toString("hex")}!`,
  };
  await db.query(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
    values ($1,$2,'authenticated','authenticated',$3,extensions.crypt($4,extensions.gen_salt('bf')),now(),'','','','','','','','','{"provider":"email","providers":["email"]}','{"first_name":"בדיקת","last_name":"E2E"}',now(),now(),false,false)`, [instanceId, user.id, user.email, user.password]);
  await db.query(`insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id)
    values ($1::text,$1::uuid,jsonb_build_object('sub',$1::text,'email',$2::text),'email',now(),now(),now(),gen_random_uuid())`, [user.id, user.email]);
  const session = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  user.token = session.access_token;
  user.appId = (await db.query("select id from public.users where auth_user_id = $1", [user.id])).rows[0].id;
  return user;
}

async function cleanup(ids = []) {
  const authIds = ids.length
    ? ids
    : (await db.query("select id from auth.users where email like 'e2e+browser-%@itaykarkason.com'"))
        .rows.map((row) => row.id);
  if (!authIds.length) return;
  await db.query("delete from public.notifications where user_id in (select id from public.users where auth_user_id = any($1::uuid[]))", [authIds]).catch(() => {});
  await db.query(`delete from public.coupon_shares where shared_by_user_id in (select id from public.users where auth_user_id = any($1::uuid[]))
    or shared_with_user_id in (select id from public.users where auth_user_id = any($1::uuid[]))`, [authIds]).catch(() => {});
  await db.query("delete from public.coupon where user_id in (select id from public.users where auth_user_id = any($1::uuid[]))", [authIds]).catch(() => {});
  await db.query("delete from public.users where auth_user_id = any($1::uuid[])", [authIds]).catch(() => {});
  await db.query("delete from auth.users where id = any($1::uuid[])", [authIds]).catch(() => {});
}

await db.connect();
try {
  if (process.argv[2] === "cleanup") {
    let ids = [];
    try {
      ids = JSON.parse(await readFile(statePath, "utf8")).authIds || [];
    } catch {}
    await cleanup(ids);
    await unlink(statePath).catch(() => {});
    console.log("browser E2E fixture cleaned");
  } else if (process.argv[2] === "create") {
    await cleanup();
    const stamp = Date.now();
    const instanceId = (await db.query("select instance_id from auth.users limit 1")).rows[0].instance_id;
    const owner = await makeUser(instanceId, stamp, 1);
    const sender = await makeUser(instanceId, stamp, 2);
    const expiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const primary = (await vault(owner.token, { action: "create", coupon: {
      company: "GoodPharm", code: "9376760189312784", cvv: "359", card_exp: "08/31",
      description: "fixture", value: 100, cost: 80, used_value: 84.8, status: "פעיל",
      expiration: "2031-08-31", date_added: new Date().toISOString(),
    } })).data;
    await vault(owner.token, { action: "create", coupon: {
      company: "גוד פארם", code: "E2E-SECOND", cvv: "111", card_exp: "09/31",
      description: "fixture", value: 100, cost: 75, used_value: 88.7, status: "פעיל",
      expiration: expiry, date_added: new Date().toISOString(),
    } });
    const sharedCoupon = (await vault(sender.token, { action: "create", coupon: {
      company: "Wolt", code: "E2E-SHARED", cvv: "222", card_exp: "10/31",
      description: "fixture", value: 150, cost: 120, used_value: 10, status: "פעיל",
      expiration: "2031-10-31", date_added: new Date().toISOString(),
    } })).data;
    await vault(sender.token, { action: "create_share", couponId: sharedCoupon.id, recipientEmail: owner.email });
    await db.query(`insert into public.notifications(user_id,type,title,message,link,shown,viewed,hide_from_view)
      values ($1,'balance_updated','היתרה עודכנה','היתרה בקופון GoodPharm עודכנה','/coupons/' || $2,false,false,false),
             ($1,'share_received','קופון שותף איתך','קיבלת קופון חדש מ־Wolt','/sharing',false,null,false),
             ($1,'idle_money','כסף שמחכה למימוש','יש לך יתרה זמינה ב־GoodPharm','/coupons',true,true,false)`,
      [owner.appId, primary.id]);

    await writeFile(statePath, JSON.stringify({
      email: owner.email,
      password: owner.password,
      authIds: [owner.id, sender.id],
      couponId: primary.id,
    }), { mode: 0o600 });
    await chmod(statePath, 0o600);
    console.log("browser E2E fixture ready");
  } else {
    throw new Error("Expected create or cleanup");
  }
} finally {
  await db.end();
}
