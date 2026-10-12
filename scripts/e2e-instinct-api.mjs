// Live read-only API security checks. Temporary key is held in memory, then
// revoked and removed in finally. Never prints credentials or account data.
// Run after sourcing .env.supabase.local.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';

const url = new URL(process.env.DATABASE_URL.replace('postgresql+psycopg2:', 'postgresql:'));
url.searchParams.delete('sslmode');
const db = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
await db.connect();
const key = 'cm_instinct_'+crypto.randomBytes(32).toString('hex');
const hash = crypto.createHash('sha256').update(key).digest('hex');
const base = process.env.SUPABASE_URL+'/functions/v1/instinct-api';
let id;
let checks=0;
function check(condition, message) { assert.ok(condition,message); checks++; }
async function api(path, status=200, options={}) {
  const response = await fetch(base+path, { headers:{ Authorization:'Bearer '+key }, ...options });
  check(response.status===status, `Expected ${status} for ${path.split('?')[0]}, got ${response.status}`);
  check(response.headers.get('cache-control')==='no-store','Sensitive responses must not be cached');
  return response.json();
}
let fixtureAuthId, fixtureAppId, ownFixtureId;
const fixtureCode='E2E-INSTINCT-'+crypto.randomBytes(8).toString('hex');
const fixtureDescription='בדיקת פענוח בלבד';
async function fixture() {
  fixtureAuthId=crypto.randomUUID();
  const email=`e2e+instinct-${Date.now()}@itaykarkason.com`;
  const password=crypto.randomBytes(24).toString('hex')+'Aa!';
  const instance=(await db.query('select instance_id from auth.users limit 1')).rows[0].instance_id;
  await db.query(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
    values($1,$2,'authenticated','authenticated',$3,extensions.crypt($4,extensions.gen_salt('bf')),now(),'','','','','','','','','{"provider":"email","providers":["email"]}','{"first_name":"E2E","last_name":"Instinct"}',now(),now(),false,false)`,[instance,fixtureAuthId,email,password]);
  await db.query(`insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id)
    values($1::text,$1::uuid,jsonb_build_object('sub',$1::text,'email',$2::text),'email',now(),now(),now(),gen_random_uuid())`,[fixtureAuthId,email]);
  const response=await fetch(process.env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:process.env.SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(response.status,200,'Fixture login');
  const session=await response.json();
  fixtureAppId=(await db.query('select id from public.users where auth_user_id=$1',[fixtureAuthId])).rows[0].id;
  const call=async (name,body) => fetch(process.env.SUPABASE_URL+'/functions/v1/'+name,{method:'POST',headers:{apikey:process.env.SUPABASE_ANON_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const denied=await call('manage-instinct-keys',{action:'create',email,label:'test',days:30,consent:true,consent_version:'instinct-decrypted-v1'});
  check(denied.status===403,'Ordinary user cannot create keys');
  await db.query('update public.users set is_admin=true where id=$1',[fixtureAppId]);
  const otherAdmin=await call('manage-instinct-keys',{action:'list'});
  check(otherAdmin.status===403,'Other administrator cannot manage keys');
  await db.query('update public.users set is_admin=false where id=$1',[fixtureAppId]);
  const created=await call('coupon-vault',{action:'create',coupon:{company:'GoodPharm',code:fixtureCode,description:fixtureDescription,cvv:'456',card_exp:'12/31',value:100,cost:80,used_value:10,status:'פעיל',auto_update:false}});
  assert.equal(created.status,201,'Encrypted fixture creation');
  const result=await created.json();
  ownFixtureId=(await db.query(`insert into public.coupon(user_id,company,code,description,cvv,card_exp,value,cost,used_value,status,auto_update)
    select 1,company,code,description,cvv,card_exp,value,cost,used_value,status,false from public.coupon where id=$1 returning id`,[result.data.id])).rows[0].id;
}

try {
  await fixture();
  // This credential only exists for this authorized verification run.
  id=(await db.query(`insert into public.instinct_api_keys(user_id,created_by,label,key_hash,key_prefix,expires_at,consent_version)
    values(1,1,'E2E temporary verification',$1,$2,now()+interval '10 minutes','instinct-decrypted-v1') returning id`,[hash,key.slice(0,19)])).rows[0].id;
  const schema=await api('/schema');
  check(schema.user_id===1 && schema.read_only===true,'Only user 1, read-only');
  check(schema.tables.length===8,'Expected resource catalog');
  for (const table of schema.tables) {
    const result=await api('/'+table.name+'?limit=1');
    check(Array.isArray(result.rows) && result.rows.length<=1,'Pagination');
    check(!JSON.stringify(result).includes('scope_user_id'),'Internal scope not exposed');
    check(!table.columns.some(c=>['password','auth_user_id','key_hash','push_token'].includes(c.name)),'Credentials excluded');
  }
  const ownIds=(await db.query('select id from public.coupon where user_id=1 and deleted_at is null')).rows.map(r=>r.id);
  const rows=await api('/coupon?select=id,company,remaining_value&limit=200');
  check(rows.rows.every(r=>ownIds.includes(r.id)),'Owner scope enforced');
  check(rows.total===ownIds.length,'Scoped total correct');
  const empty=await api('/coupon?select=id&offset=1000000');
  check(empty.rows.length===0 && empty.total===ownIds.length,'Empty page preserves total');
  const foreign=(await db.query('select id from public.coupon where user_id<>1 and deleted_at is null limit 1')).rows[0];
  assert.ok(foreign,'Need foreign record for isolation test');
  const foreignResult=await api('/coupon?id=eq.'+foreign.id);
  check(foreignResult.rows.length===0 && foreignResult.total===0,'Foreign record never exposed');
  for (const table of ['coupon_usage','coupon_transaction','coupon_tags']) {
    const result=await api('/'+table+'?coupon_id=eq.'+foreign.id);
    check(result.total===0,'Foreign related records never exposed');
  }
  const profile=await api('/users');
  check(profile.rows.length===1 && profile.rows[0].id===1,'Only own profile');
  const encrypted=(await db.query('select code,description from public.coupon where id=$1',[ownFixtureId])).rows[0];
  check(encrypted.code.startsWith('gAAAAA') && encrypted.description.startsWith('gAAAAA'),'Fixture encrypted at rest');
  const clear=await api('/coupon?id=eq.'+ownFixtureId+'&select=id,code,description,cvv,card_exp');
  for (const [field,expected] of Object.entries({code:fixtureCode,description:fixtureDescription,cvv:'456',card_exp:'12/31'})) check(clear.rows[0][field]===expected,'Correct decryption: '+field);
  const summary=await api('/summary');
  check(summary.coupon_count===ownIds.length,'Summary includes entire scoped dataset');
  await api('/coupon?select=password',400);
  await api('/coupon?user_id=eq.2',400);
  await api('/coupon?scope_user_id=eq.2',400);
  await api('/coupon?description=ilike.*test*',400);
  await api('/coupon?order=code.asc',400);
  await api('/coupon?limit=201',400);
  await api('/coupon?offset=-1',400);
  await api('/users?select=auth_user_id',400);
  await api('/instinct_api_keys',404);
  await api('/constructor',404);
  const injection=await fetch(base+'/coupon?'+new URLSearchParams({company:"eq.' OR 1=1; --"}),{headers:{Authorization:'Bearer '+key}});
  check(injection.status===403 && injection.headers.get('server')==='cloudflare','WAF blocks SQL injection before handler');
  const sqlInjection=await db.query("select public.instinct_read($1,'coupon',null,$2::jsonb) result",[hash,JSON.stringify([{column:'company',op:'eq',value:"' OR 1=1; --"}])]);
  check(sqlInjection.rows[0].result.total===0,'SQL-looking value remains data inside database');
  await api('/schema',401,{headers:{}});
  await api('/schema',401,{headers:{Authorization:'Bearer cm_instinct_'+'a'.repeat(64)}});
  for (const method of ['POST','PUT','PATCH','DELETE']) await api('/coupon',405,{method});
  const viaQuery=await fetch(base+'/schema?apikey='+encodeURIComponent(key));
  check(viaQuery.status===200,'Instinct query-key compatibility');
  await db.query('update public.instinct_api_keys set request_count=120,request_window=now() where id=$1',[id]);
  await api('/schema',429);
  await db.query("update public.instinct_api_keys set request_count=0,expires_at=now()-interval '1 second' where id=$1",[id]);
  await api('/schema',401);
  await db.query("update public.instinct_api_keys set expires_at=now()+interval '10 minutes',revoked_at=now() where id=$1",[id]);
  await api('/schema',401);
  const denied=await fetch(process.env.SUPABASE_URL+'/rest/v1/instinct_api_keys?select=key_hash',{headers:{apikey:process.env.SUPABASE_ANON_KEY,Authorization:'Bearer '+process.env.SUPABASE_ANON_KEY}});
  check(denied.status===401 || denied.status===403,'Anonymous direct key-table access denied');
  await db.query('begin');
  await db.query('set local role service_role');
  const sessions=await db.query('select public.instinct_admin_session_valid($1,$2) valid',[crypto.randomUUID(),crypto.randomUUID()]);
  check(sessions.rows[0].valid===false,'Forged session rejected');
  await db.query('rollback');
  const direct=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/instinct_read',{method:'POST',headers:{apikey:process.env.SUPABASE_ANON_KEY,Authorization:'Bearer '+process.env.SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_hash:hash,p_table:'users'})});
  check([401,403,404].includes(direct.status),'Anonymous RPC cannot bypass edge authentication');
  console.log(`PASS: ${checks} live API/security assertions; no credentials or account data printed.`);
} finally {
  await db.query('rollback');
  if (id) await db.query('delete from public.instinct_api_keys where id=$1',[id]);
  if (ownFixtureId) await db.query('delete from public.coupon where id=$1',[ownFixtureId]);
  if (fixtureAppId) {
    await db.query('delete from public.coupon where user_id=$1',[fixtureAppId]);
    await db.query('delete from public.users where id=$1',[fixtureAppId]);
  }
  if (fixtureAuthId) await db.query('delete from auth.users where id=$1',[fixtureAuthId]);
  await db.end();
}
