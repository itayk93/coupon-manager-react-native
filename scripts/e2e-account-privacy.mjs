// Destructive-by-design E2E for one throwaway account against deployed Supabase.
// Contract: consent and export belong to caller; delete_account removes app row,
// auth identity, dependent data, and profile image. Never targets existing users.

import crypto from "node:crypto";
import pg from "pg";

const required = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);

const databaseUrl = new URL(process.env.DATABASE_URL.replace("postgresql+psycopg2:", "postgresql:"));
databaseUrl.searchParams.delete("sslmode");
const db = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } });
const stamp = Date.now();
const user = {
  id: crypto.randomUUID(),
  email: `e2e+account-privacy-${stamp}@itaykarkason.com`,
  password: `E2e-${crypto.randomBytes(18).toString("hex")}!`,
};
const storagePath = `${user.id}/e2e-profile.txt`;
let appUserId;
let failures = 0;

function check(label, ok, detail = "") {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ""}`);
  }
}

async function jsonFetch(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function vault(token, body) {
  return jsonFetch(`${process.env.SUPABASE_URL}/functions/v1/coupon-vault`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function storage(method, path, body) {
  return fetch(`${process.env.SUPABASE_URL}/storage/v1/object/profile-images/${path}`, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(body ? { "content-type": "text/plain", "x-upsert": "true" } : {}),
    },
    body,
  });
}

await db.connect();
try {
  const instanceId = (await db.query("select instance_id from auth.users limit 1")).rows[0].instance_id;
  await db.query(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
    values ($1,$2,'authenticated','authenticated',$3,extensions.crypt($4,extensions.gen_salt('bf')),now(),'','','','','','','','','{"provider":"email","providers":["email"]}','{"first_name":"E2E","last_name":"Privacy"}',now(),now(),false,false)`,
    [instanceId, user.id, user.email, user.password]);
  await db.query(`insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id)
    values ($1::text,$1::uuid,jsonb_build_object('sub',$1::text,'email',$2::text),'email',now(),now(),now(),gen_random_uuid())`,
    [user.id, user.email]);

  const session = await jsonFetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  const token = session.body?.access_token;
  check("throwaway account can authenticate", session.status === 200 && Boolean(token), JSON.stringify(session.body));
  if (!token) throw new Error("E2E session missing");

  appUserId = (await db.query("select id from public.users where auth_user_id = $1", [user.id])).rows[0]?.id;
  check("auth trigger creates linked app user", Number.isInteger(appUserId));

  const consent = await vault(token, { action: "record_consent", version: "e2e-privacy" });
  check("consent endpoint accepts explicit version", consent.status === 200 && consent.body?.data?.version === "e2e-privacy", JSON.stringify(consent.body));
  const consentRow = (await db.query("select consent_status, version from public.user_consents where user_id=$1 order by consent_id desc limit 1", [appUserId])).rows[0];
  check("consent audit row belongs to caller", consentRow?.consent_status === true && consentRow?.version === "e2e-privacy");

  const coupon = await vault(token, { action: "create", coupon: {
    company: "E2E Privacy", code: "ERASE-ME", description: "export me", value: 100,
    cost: 80, used_value: 0, status: "פעיל", date_added: new Date().toISOString(),
  } });
  check("fixture coupon created", coupon.status === 201 && coupon.body?.data?.code === "ERASE-ME", JSON.stringify(coupon.body));

  const upload = await storage("POST", storagePath, "temporary profile image fixture");
  check("profile object fixture uploaded", upload.ok, `HTTP ${upload.status}`);
  await db.query("update public.users set profile_image=$1 where id=$2", [`profile-image:${storagePath}`, appUserId]);

  const exported = await vault(token, { action: "export_account" });
  const exportedCoupon = exported.body?.data?.coupons?.find((row) => row.code === "ERASE-ME");
  check("export returns caller profile", exported.status === 200 && exported.body?.data?.profile?.email === user.email, JSON.stringify(exported.body)?.slice(0, 300));
  check("export decrypts caller coupon", Boolean(exportedCoupon));
  check("export includes consent trail", exported.body?.data?.consents?.some((row) => row.version === "e2e-privacy"));

  const deleted = await vault(token, { action: "delete_account" });
  check("delete endpoint reports success", deleted.status === 200 && deleted.body?.data?.deleted === true, JSON.stringify(deleted.body));
  check("app user removed", Number((await db.query("select count(*) from public.users where id=$1", [appUserId])).rows[0].count) === 0);
  check("auth identity removed", Number((await db.query("select count(*) from auth.users where id=$1", [user.id])).rows[0].count) === 0);
  check("owned coupon removed", Number((await db.query("select count(*) from public.coupon where user_id=$1", [appUserId])).rows[0].count) === 0);
  check("consent audit removed", Number((await db.query("select count(*) from public.user_consents where user_id=$1", [appUserId])).rows[0].count) === 0);
  const objectAfterDelete = await storage("GET", storagePath);
  check("profile object removed", objectAfterDelete.status === 404, `HTTP ${objectAfterDelete.status}`);
} finally {
  await storage("DELETE", storagePath).catch(() => {});
  if (appUserId) {
    await db.query("delete from public.coupon where user_id=$1", [appUserId]).catch(() => {});
    await db.query("delete from public.users where id=$1", [appUserId]).catch(() => {});
  }
  await db.query("delete from auth.users where id=$1", [user.id]).catch(() => {});
  await db.end();
}

console.log(failures ? `\n${failures} account-privacy E2E check(s) failed` : "\naccount-privacy E2E passed");
process.exit(failures ? 1 : 0);
