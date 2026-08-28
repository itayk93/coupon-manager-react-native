// End-to-end check for the notification feed mutations against the real deployment.
// Creates two throwaway accounts, verifies read/hide ownership, then removes all data.

import pg from "pg";
import crypto from "node:crypto";

const required = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY"];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);

const databaseUrl = new URL(process.env.DATABASE_URL.replace("postgresql+psycopg2:", "postgresql:"));
databaseUrl.searchParams.delete("sslmode");
const db = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } });
const stamp = Date.now();
const users = [1, 2].map((number) => ({
  id: crypto.randomUUID(),
  email: `e2e+notifications-${stamp}-${number}@itaykarkason.com`,
  password: `E2e-${crypto.randomBytes(16).toString("hex")}!`,
}));

let failures = 0;
function check(label, ok, detail = "") {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ""}`);
  }
}

function headers(token, extra = {}) {
  return {
    apikey: process.env.SUPABASE_ANON_KEY,
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    ...extra,
  };
}

async function rest(path, token, init = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: headers(token, init.headers),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

await db.connect();
try {
  const instance = (await db.query("select instance_id from auth.users limit 1")).rows[0].instance_id;
  for (const user of users) {
    await db.query(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
      values ($1,$2,'authenticated','authenticated',$3,extensions.crypt($4,extensions.gen_salt('bf')),now(),'','','','','','','','','{"provider":"email","providers":["email"]}','{"first_name":"E2E","last_name":"Notifications"}',now(),now(),false,false)`, [instance, user.id, user.email, user.password]);
    await db.query(`insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id)
      values ($1::text,$1::uuid,jsonb_build_object('sub',$1::text,'email',$2::text),'email',now(),now(),now(),gen_random_uuid())`, [user.id, user.email]);
    const session = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: headers(process.env.SUPABASE_ANON_KEY),
      body: JSON.stringify({ email: user.email, password: user.password }),
    }).then((response) => response.json());
    user.token = session.access_token;
    user.appId = (await db.query("select id from public.users where auth_user_id = $1", [user.id])).rows[0].id;
  }

  const inserted = (await db.query(
    `insert into public.notifications(user_id,type,title,message,shown,viewed,hide_from_view)
     values ($1,'balance_updated','E2E 1','one',false,false,false),
            ($1,'share_received','E2E 2','two',false,null,false),
            ($2,'balance_updated','E2E other','other',false,false,false)
     returning id,user_id`,
    [users[0].appId, users[1].appId],
  )).rows;
  const ownIds = inserted.filter((row) => row.user_id === users[0].appId).map((row) => row.id);
  const otherId = inserted.find((row) => row.user_id === users[1].appId).id;

  const list = await rest("notifications?select=id,viewed,hide_from_view&order=id", users[0].token);
  check("lists only the signed-in user's notifications", list.status === 200 && list.body.length === 2);

  const markAll = await rest(
    "notifications?hide_from_view=eq.false&viewed=not.is.true",
    users[0].token,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ viewed: true, shown: true }) },
  );
  check(
    "marks false and null unread rows in one request",
    markAll.status === 200 && markAll.body.length === 2,
    JSON.stringify(markAll),
  );

  const cannotTouchOther = await rest(
    `notifications?id=eq.${otherId}`,
    users[0].token,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ hide_from_view: true }) },
  );
  check("cannot hide another user's notification", cannotTouchOther.status === 200 && cannotTouchOther.body.length === 0);

  const hideOwn = await rest(
    `notifications?id=eq.${ownIds[0]}`,
    users[0].token,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ hide_from_view: true }) },
  );
  check("hides an owned notification without deleting it", hideOwn.status === 200 && hideOwn.body[0]?.hide_from_view === true);

  const rowStillExists = (await db.query("select count(*)::int as count from public.notifications where id = $1", [ownIds[0]])).rows[0].count;
  check("hidden history remains in the database", rowStillExists === 1);

  console.log(failures === 0 ? "\nnotifications E2E passed\n" : `\n${failures} check(s) failed\n`);
} finally {
  await db.query("delete from public.notifications where user_id = any($1::bigint[])", [users.map((user) => user.appId).filter(Boolean)]).catch(() => {});
  await db.query("delete from public.users where auth_user_id = any($1::uuid[])", [users.map((user) => user.id)]).catch(() => {});
  await db.query("delete from auth.users where id = any($1::uuid[])", [users.map((user) => user.id)]).catch(() => {});
  await db.end();
}

process.exit(failures === 0 ? 0 : 1);
