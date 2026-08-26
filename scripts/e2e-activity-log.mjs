// End-to-end check of the activity log, against a real deployment.
//
// The promises worth proving are the ones that fail silently: that the account
// on a row comes from the JWT and not the body, that a coupon code cannot be
// smuggled into metadata, and that a signed-in user cannot write to the table
// directly. None of those surface as an error in the app if they break.
//
// Creates two throwaway accounts, exercises the endpoint, and deletes
// everything it made — same pattern as e2e-coupon-vault.mjs.
//
//   set -a && . ./.env.supabase.local && set +a && node scripts/e2e-activity-log.mjs

import pg from 'pg';
import crypto from 'node:crypto';

const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);

const databaseUrl = new URL(process.env.DATABASE_URL.replace('postgresql+psycopg2:', 'postgresql:'));
databaseUrl.searchParams.delete('sslmode');
const db = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } });

const stamp = Date.now();
const users = [1, 2].map((n) => ({
  id: crypto.randomUUID(),
  email: `e2e+activity-log-${stamp}-${n}@itaykarkason.com`,
  password: `E2e-${crypto.randomBytes(16).toString('hex')}!`,
}));

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`); }
};

async function logEvents(token, events) {
  const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/log-activity`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ events }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

await db.connect();
try {
  const instance = (await db.query('select instance_id from auth.users limit 1')).rows[0].instance_id;
  for (const user of users) {
    await db.query(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
      values ($1,$2,'authenticated','authenticated',$3,extensions.crypt($4,extensions.gen_salt('bf')),now(),'','','','','','','','','{"provider":"email","providers":["email"]}','{"first_name":"E2E","last_name":"Activity"}',now(),now(),false,false)`, [instance, user.id, user.email, user.password]);
    await db.query(`insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id)
      values ($1::text,$1::uuid,jsonb_build_object('sub',$1::text,'email',$2::text),'email',now(),now(),now(),gen_random_uuid())`, [user.id, user.email]);

    const session = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: process.env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: user.password }),
    }).then((r) => r.json());
    user.token = session.access_token;
    user.appId = (await db.query('select id from public.users where auth_user_id = $1', [user.id])).rows[0]?.id;
  }

  console.log('\nlog-activity\n');

  // 1. The happy path.
  const ok = await logEvents(users[0].token, [
    { action: 'page_access', metadata: { screen: '/coupons', from: '/' } },
    { action: 'view_coupon', coupon_id: 12345 },
  ]);
  check('accepts a batch', ok.status === 200 && ok.body?.recorded === 2, JSON.stringify(ok.body));

  const rows = (await db.query(
    'select action, coupon_id, extra_metadata, ip_address, device from public.user_activities where user_id = $1 order by activity_id',
    [users[0].appId],
  )).rows;
  check('stored both rows against the caller', rows.length === 2);
  check('kept the screen and the route it came from',
    rows[0]?.extra_metadata?.screen === '/coupons' && rows[0]?.extra_metadata?.from === '/');
  check('kept the coupon id', rows[1]?.coupon_id === 12345);
  check('stamped the IP from the request', Boolean(rows[0]?.ip_address));
  check('stamped the device from the request', Boolean(rows[0]?.device));

  // 2. Identity comes from the token, not the body.
  await logEvents(users[0].token, [
    { action: 'login_success', user_id: users[1].appId, action_user: users[1].appId },
  ]);
  const stolen = (await db.query(
    "select count(*)::int as n from public.user_activities where user_id = $1",
    [users[1].appId],
  )).rows[0].n;
  check('cannot attribute an event to another account', stolen === 0);

  // 3. Secrets never land, whatever the caller sends.
  await logEvents(users[0].token, [
    { action: 'view_coupon_code', coupon_id: 999, metadata: { code: 'SECRET-1234', cvv: '987', company: 'VANS' } },
  ]);
  const scrubbed = (await db.query(
    "select extra_metadata from public.user_activities where user_id = $1 and action = 'view_coupon_code'",
    [users[0].appId],
  )).rows[0]?.extra_metadata;
  check('dropped the code and cvv', !JSON.stringify(scrubbed || {}).includes('SECRET-1234')
    && !JSON.stringify(scrubbed || {}).includes('987'), JSON.stringify(scrubbed));
  check('kept the harmless field beside them', scrubbed?.company === 'VANS');

  // 4. An action outside the shared vocabulary is refused, not stored.
  const forged = await logEvents(users[0].token, [{ action: 'delete_everything' }]);
  check('rejects an unknown action', forged.body?.recorded === 0 && forged.body?.rejected === 1);

  // 5. Batch cap.
  const flood = await logEvents(users[0].token,
    Array.from({ length: 51 }, () => ({ action: 'page_access' })));
  check('caps the batch size', flood.status === 400);

  // 6. The client cannot write to the table directly any more.
  const direct = await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_activities`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${users[0].token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ user_id: users[0].appId, action: 'page_access' }),
  });
  check('refuses a direct insert from a signed-in client', direct.status === 401 || direct.status === 403,
    `HTTP ${direct.status}`);

  // 7. But reading your own history still works.
  const own = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/user_activities?select=action&limit=5`,
    { headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${users[0].token}` } },
  );
  check('lets a user read their own history', own.status === 200, `HTTP ${own.status}`);

  console.log(failures === 0 ? '\nactivity-log E2E passed\n' : `\n${failures} check(s) failed\n`);
} finally {
  await db.query('delete from public.user_activities where user_id in (select id from public.users where auth_user_id = any($1::uuid[]))', [users.map((u) => u.id)]).catch(() => {});
  await db.query('delete from public.users where auth_user_id = any($1::uuid[])', [users.map((u) => u.id)]).catch(() => {});
  await db.query('delete from auth.users where id = any($1::uuid[])', [users.map((u) => u.id)]).catch(() => {});
  await db.end();
}

process.exit(failures === 0 ? 0 : 1);
