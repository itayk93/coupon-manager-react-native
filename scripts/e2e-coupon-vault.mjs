import pg from 'pg';
import crypto from 'node:crypto';

const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);
const databaseUrl = new URL(process.env.DATABASE_URL.replace('postgresql+psycopg2:', 'postgresql:'));
databaseUrl.searchParams.delete('sslmode');
const db = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } });
const stamp = Date.now();
const users = [1, 2].map((n) => ({ id: crypto.randomUUID(), email: `e2e+coupon-vault-${stamp}-${n}@itaykarkason.com`, password: `E2e-${crypto.randomBytes(16).toString('hex')}!` }));

async function api(path, init = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function vault(token, body) {
  return api('/functions/v1/coupon-vault', { method: 'POST', headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

await db.connect();
try {
  const instance = (await db.query('select instance_id from auth.users limit 1')).rows[0].instance_id;
  for (const user of users) {
    await db.query(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
      values ($1,$2,'authenticated','authenticated',$3,extensions.crypt($4,extensions.gen_salt('bf')),now(),'','','','','','','','','{"provider":"email","providers":["email"]}','{"first_name":"E2E","last_name":"Test"}',now(),now(),false,false)`, [instance, user.id, user.email, user.password]);
    await db.query(`insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id)
      values ($1::text,$1::uuid,jsonb_build_object('sub',$1::text,'email',$2::text),'email',now(),now(),now(),gen_random_uuid())`, [user.id, user.email]);
    const session = await api('/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: process.env.SUPABASE_ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, password: user.password }) });
    user.token = session.access_token;
  }

  const created = (await vault(users[0].token, { action: 'create', coupon: { company: 'E2E Vault', code: 'SECRET-123', description: 'private description', cvv: '987', card_exp: '12/30', value: 100, cost: 80, used_value: 0, status: 'פעיל', date_added: new Date().toISOString() } })).data;
  if (created.code !== 'SECRET-123' || created.cvv !== '987') throw new Error('Create did not decrypt');
  const raw = (await db.query('select code,description,cvv from public.coupon where id=$1', [created.id])).rows[0];
  if (!raw.code.startsWith('gAAAAA') || raw.code.includes('SECRET-123')) throw new Error('Database value is not encrypted');
  const listed = (await vault(users[0].token, { action: 'list' })).data;
  if (!listed.some((coupon) => coupon.id === created.id && coupon.code === 'SECRET-123')) throw new Error('List failed');
  const updated = (await vault(users[0].token, { action: 'update', id: created.id, updates: { code: 'SECRET-456', description: 'updated' } })).data;
  if (updated.code !== 'SECRET-456') throw new Error('Update failed');
  const denied = await fetch(`${process.env.SUPABASE_URL}/functions/v1/coupon-vault`, { method: 'POST', headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${users[1].token}`, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'get', id: created.id }) });
  if (denied.status !== 404) throw new Error(`Ownership check failed: ${denied.status}`);
  const share = (await vault(users[0].token, { action: 'create_share', couponId: created.id, recipientEmail: users[1].email })).data;
  const received = (await vault(users[1].token, { action: 'shared_with_me' })).data;
  if (!received.some((item) => item.id === share.id && item.coupon.code === 'SECRET-456')) throw new Error('Shared read failed');
  await vault(users[0].token, { action: 'revoke_share', id: share.id });
  const afterRevoke = (await vault(users[1].token, { action: 'shared_with_me' })).data;
  if (afterRevoke.some((item) => item.id === share.id)) throw new Error('Revoke failed');
  console.log('coupon-vault E2E passed: auth, create, encrypted-at-rest, list, update, ownership, share, revoke');
} finally {
  await db.query(`delete from public.coupon_shares where shared_by_user_id in (select id from public.users where auth_user_id = any($1::uuid[])) or shared_with_user_id in (select id from public.users where auth_user_id = any($1::uuid[]))`, [users.map((u) => u.id)]).catch(() => {});
  await db.query('delete from public.coupon where user_id in (select id from public.users where auth_user_id = any($1::uuid[]))', [users.map((u) => u.id)]).catch(() => {});
  await db.query('delete from public.users where auth_user_id = any($1::uuid[])', [users.map((u) => u.id)]).catch(() => {});
  await db.query('delete from auth.users where id = any($1::uuid[])', [users.map((u) => u.id)]).catch(() => {});
  await db.end();
}
