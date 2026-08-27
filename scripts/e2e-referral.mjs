// End-to-end check of the referral pilot, against a real deployment.
//
// A referral system decides who gets paid, so the promises worth proving are
// the ones nobody would notice breaking: that the account being attributed
// comes from the JWT and not the body, that attribution locks on the first
// claim, that a chain three people deep still rolls up to the partner who
// started it, and that qualification counts real coupon activity on separate
// days rather than app opens.
//
// Builds a whole chain out of throwaway accounts, walks it through activation
// and retention, and deletes everything it made — same pattern as
// e2e-activity-log.mjs.
//
//   set -a && . ./.env.supabase.local && set +a && node scripts/e2e-referral.mjs

import pg from 'pg';
import crypto from 'node:crypto';

const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);

const databaseUrl = new URL(process.env.DATABASE_URL.replace('postgresql+psycopg2:', 'postgresql:'));
databaseUrl.searchParams.delete('sslmode');
const db = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } });

const stamp = Date.now();
const CAMPAIGN_CODE = `E2E${stamp.toString(36).toUpperCase().slice(-6)}`;

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`); }
};

async function makeUser(n) {
  const user = {
    id: crypto.randomUUID(),
    email: `e2e+referral-${stamp}-${n}@itaykarkason.com`,
    password: `E2e-${crypto.randomBytes(16).toString('hex')}!`,
  };
  const instance = (await db.query('select instance_id from auth.users limit 1')).rows[0].instance_id;
  await db.query(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
    values ($1,$2,'authenticated','authenticated',$3,extensions.crypt($4,extensions.gen_salt('bf')),now(),'','','','','','','','','{"provider":"email","providers":["email"]}','{"first_name":"E2E","last_name":"Referral"}',now(),now(),false,false)`,
    [instance, user.id, user.email, user.password]);
  await db.query(`insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id)
    values ($1::text,$1::uuid,jsonb_build_object('sub',$1::text,'email',$2::text),'email',now(),now(),now(),gen_random_uuid())`,
    [user.id, user.email]);

  const session = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  }).then((r) => r.json());
  user.token = session.access_token;
  user.appId = (await db.query('select id from public.users where auth_user_id = $1', [user.id])).rows[0]?.id;
  // Registered a fortnight ago — still inside the attribution window, but far
  // enough back that "three separate days" is something the test can stage.
  await db.query(`update public.users set created_at = now() - interval '13 days' where id = $1`, [user.appId]);
  return user;
}

async function claim(user, code, installId) {
  const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/claim-referral`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${user.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ code, install_id: installId }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

/** Coupon activity on `days` separate days, ending `endDaysAgo` days back. */
async function seedActivity(user, endDaysAgo, days) {
  for (let day = 0; day < days; day += 1) {
    await db.query(
      `insert into public.user_activities(user_id, action, timestamp)
       values ($1, 'view_coupon', now() - interval '1 day' * $2)`,
      [user.appId, endDaysAgo + day],
    );
  }
}

const made = { users: [], campaign: null, extraCampaigns: [] };

await db.connect();
try {
  console.log('\nreferral pilot\n');

  // A campaign of our own, so nothing here touches the real pilot's numbers.
  made.campaign = (await db.query(
    `insert into public.referral_campaigns(name, partner_name, code, notes)
     values ('E2E', 'E2E partner', $1, 'throwaway') returning id`,
    [CAMPAIGN_CODE],
  )).rows[0].id;

  // Sequentially: one pg client cannot run four queries at once.
  const [alice, bob, carol, mallory] = [await makeUser(1), await makeUser(2), await makeUser(3), await makeUser(4)];
  made.users.push(alice, bob, carol, mallory);

  // 1. The chain.
  const first = await claim(alice, CAMPAIGN_CODE, 'install-alice');
  check('a campaign code attributes the first user', first.body?.status === 'claimed', JSON.stringify(first.body));

  const aliceCode = (await db.query('select code from public.referral_codes where user_id = $1', [alice.appId])).rows[0]?.code;
  check('claiming issues the newcomer their own code', Boolean(aliceCode));

  const second = await claim(bob, aliceCode, 'install-bob');
  check('a personal code attributes through the chain', second.body?.status === 'claimed', JSON.stringify(second.body));

  const bobCode = (await db.query('select code from public.referral_codes where user_id = $1', [bob.appId])).rows[0]?.code;
  const third = await claim(carol, bobCode, 'install-carol');
  check('the chain keeps going a third level down', third.body?.status === 'claimed', JSON.stringify(third.body));

  const chain = (await db.query(
    'select referred_user_id, depth, campaign_id from public.referrals where campaign_id = $1 order by depth',
    [made.campaign],
  )).rows;
  check('every level rolls up to the campaign that started it', chain.length === 3 && chain.every((r) => String(r.campaign_id) === String(made.campaign)));
  check('depth records how far down the chain each person is', chain.map((r) => r.depth).join() === '1,2,3', chain.map((r) => r.depth).join());

  // 2. Attribution is written once.
  const again = await claim(alice, bobCode, 'install-alice');
  check('a second claim cannot re-point an existing user', again.body?.status === 'already_attributed', JSON.stringify(again.body));
  const stillDepth1 = (await db.query('select depth from public.referrals where referred_user_id = $1', [alice.appId])).rows[0].depth;
  check('the original attribution is untouched by the attempt', stillDepth1 === 1);

  let immutable = false;
  try {
    await db.query('update public.referrals set campaign_id = campaign_id + 1 where referred_user_id = $1', [alice.appId]);
  } catch (error) { immutable = /immutable/.test(error.message); }
  check('even the database refuses to move a referral to another campaign', immutable);

  // 3. The account comes from the token, never the body.
  const spoofed = await fetch(`${process.env.SUPABASE_URL}/functions/v1/claim-referral`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${mallory.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ code: CAMPAIGN_CODE, user_id: alice.appId, p_user_id: alice.appId }),
  }).then((r) => r.json());
  check('a user_id in the body is ignored', spoofed?.status === 'claimed');
  const malloryRow = (await db.query('select referred_user_id from public.referrals where referred_user_id = $1', [mallory.appId])).rows;
  check('the row belongs to whoever held the token', malloryRow.length === 1);

  const anonymous = await fetch(`${process.env.SUPABASE_URL}/functions/v1/claim-referral`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ code: CAMPAIGN_CODE }),
  });
  check('a caller without a session is refused', anonymous.status === 401, `got ${anonymous.status}`);

  const nonsense = await claim(carol, 'NO-SUCH-CODE', null);
  check('an unknown code is a word, not an error', nonsense.status === 200 && nonsense.body?.status === 'invalid_code', JSON.stringify(nonsense.body));

  // 4. Qualification counts real use, on separate days.
  await db.query(
    `insert into public.coupon(code, value, cost, company, user_id, status, date_added, used_value)
     values ('E2E-TEST', 100, 0, 'E2E', $1, 'פעיל', now(), 0)`,
    [bob.appId],
  );
  await seedActivity(bob, 11, 2);
  await db.query('select public.refresh_referral_progress($1)', [made.campaign]);
  let bobRow = (await db.query('select * from public.referrals where referred_user_id = $1', [bob.appId])).rows[0];
  check('two days of activity is not enough to activate', bobRow.activated_at === null && bobRow.active_days_first_30 === 2);

  await seedActivity(bob, 9, 1);
  await db.query('select public.refresh_referral_progress($1)', [made.campaign]);
  bobRow = (await db.query('select * from public.referrals where referred_user_id = $1', [bob.appId])).rows[0];
  check('a coupon plus three separate days activates', bobRow.activated_at !== null && bobRow.status === 'activated');

  // Someone with the activity but no coupon of their own is not a user yet.
  await seedActivity(carol, 8, 4);
  await db.query('select public.refresh_referral_progress($1)', [made.campaign]);
  const carolRow = (await db.query('select * from public.referrals where referred_user_id = $1', [carol.appId])).rows[0];
  check('activity without a real coupon does not activate', carolRow.activated_at === null && carolRow.active_days_first_30 === 4);

  // Opening the app is not use of the app.
  await db.query(
    `insert into public.user_activities(user_id, action, timestamp)
     select $1, action, now() - interval '1 day' * g
     from unnest(array['login_success','page_access','onboarding_complete']) with ordinality as t(action, g)`,
    [mallory.appId],
  );
  await db.query(
    `insert into public.coupon(code, value, cost, company, user_id, status, date_added, used_value)
     values ('E2E-TEST-2', 100, 0, 'E2E', $1, 'פעיל', now(), 0)`,
    [mallory.appId],
  );
  await db.query('select public.refresh_referral_progress($1)', [made.campaign]);
  const malloryProgress = (await db.query('select * from public.referrals where referred_user_id = $1', [mallory.appId])).rows[0];
  check('logins and screen views count for nothing', malloryProgress.active_days_first_30 === 0 && malloryProgress.activated_at === null);

  // 5. Retention: the second-month window, checked continuously.
  // Reaching the second month means moving the registration date, which the
  // trigger just proved it forbids. Replication role is the standard way to
  // stage a row a trigger will not let you write; it is disabled again below,
  // and only ever touches rows this script created.
  await db.query('set session_replication_role = replica');
  await db.query(
    `update public.referrals set registered_at = now() - interval '45 days' where referred_user_id = $1`,
    [bob.appId],
  );
  await db.query('set session_replication_role = origin');
  await db.query('select public.refresh_referral_progress($1)', [made.campaign]);
  bobRow = (await db.query('select * from public.referrals where referred_user_id = $1', [bob.appId])).rows[0];
  check('two days in the second month is retention, on day 45 not day 60',
    bobRow.retained_at !== null && bobRow.status === 'retained', JSON.stringify({ d30: bobRow.active_days_first_30, d60: bobRow.active_days_31_60 }));

  // 6. Rewards are earned by the job and delivered by a person.
  await db.query(
    `insert into public.referral_rewards(campaign_id, label, metric, threshold, reward_type, reward_value)
     values ($1, 'e2e', 'activated', 1, 'dream_card', 50)`,
    [made.campaign],
  );
  await db.query('select public.refresh_referral_progress($1)', [made.campaign]);
  const reward = (await db.query('select * from public.referral_rewards where campaign_id = $1', [made.campaign])).rows[0];
  check('crossing a threshold stamps the reward as earned', reward.earned_at !== null);
  check('but never as paid', reward.paid_at === null);

  // 7. None of this is readable by the people in it.
  const asBob = await fetch(`${process.env.SUPABASE_URL}/rest/v1/referrals?select=*`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${bob.token}` },
  }).then((r) => r.json());
  check('a signed-in non-admin sees no referrals at all', Array.isArray(asBob) && asBob.length === 0, JSON.stringify(asBob).slice(0, 200));

  const rowsAsBob = await fetch(`${process.env.SUPABASE_URL}/rest/v1/referral_admin_rows?select=*`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${bob.token}` },
  }).then((r) => r.json());
  check('nor through the admin view', Array.isArray(rowsAsBob) && rowsAsBob.length === 0, JSON.stringify(rowsAsBob).slice(0, 200));

  const verdictAsBob = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/referral_set_fraud_status`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${bob.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_referral_id: bobRow.id, p_status: 'normal' }),
  });
  check('and cannot clear his own fraud flag', verdictAsBob.status >= 400, `got ${verdictAsBob.status}`);

  const insertAsBob = await fetch(`${process.env.SUPABASE_URL}/rest/v1/referrals`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${bob.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ referred_user_id: bob.appId, campaign_id: made.campaign, referral_code: 'X', registered_at: new Date().toISOString() }),
  });
  check('a client cannot write itself into a chain', insertAsBob.status >= 400, `got ${insertAsBob.status}`);

  // 8. His own code is all he gets — never the tally the pilot pays on.
  const own = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/my_referral_status`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${bob.token}`,
      'content-type': 'application/json',
    },
    body: '{}',
  }).then((r) => r.json());
  check('a user can read their own code', Array.isArray(own) && own[0]?.code === bobCode, JSON.stringify(own));
  check('and gets no count of who joined underneath them',
    Object.keys(own[0] ?? {}).join() === 'code', JSON.stringify(own[0]));

  const codesAsBob = await fetch(`${process.env.SUPABASE_URL}/rest/v1/referral_codes?select=*`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${bob.token}` },
  }).then((r) => r.json());
  check('nor a way round it through the codes table',
    Array.isArray(codesAsBob) && codesAsBob.length === 0, JSON.stringify(codesAsBob).slice(0, 200));

  const rewardsAsBob = await fetch(`${process.env.SUPABASE_URL}/rest/v1/referral_rewards?select=*`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${bob.token}` },
  }).then((r) => r.json());
  check('and no sight of what the pilot is worth',
    Array.isArray(rewardsAsBob) && rewardsAsBob.length === 0, JSON.stringify(rewardsAsBob).slice(0, 200));

  const campaignsAsBob = await fetch(`${process.env.SUPABASE_URL}/rest/v1/referral_campaigns?select=*`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${bob.token}` },
  }).then((r) => r.json());
  check('nor which chain he is in', Array.isArray(campaignsAsBob) && campaignsAsBob.length === 0, JSON.stringify(campaignsAsBob).slice(0, 200));

  // 9. The admin screen, from the other side of the same policy.
  await db.query('update public.users set is_admin = true where id = $1', [mallory.appId]);
  const adminHeaders = {
    apikey: process.env.SUPABASE_ANON_KEY,
    authorization: `Bearer ${mallory.token}`,
    'content-type': 'application/json',
  };

  const adminRows = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/referral_admin_rows?select=*&campaign_id=eq.${made.campaign}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check('an admin sees every referral in the campaign', Array.isArray(adminRows) && adminRows.length === 4, JSON.stringify(adminRows).slice(0, 200));
  // Bob's registration was moved back to day 45 above, so his three days of
  // activity now sit in the retention window rather than the first month.
  check('with the evidence already counted for the table',
    adminRows.some((row) => row.referred_user_id === bob.appId && row.coupon_count === 1 && row.active_days_31_60 === 3
      && row.status === 'retained'));
  check('and the name of whoever referred them', adminRows.some((row) => row.referrer_name?.includes('E2E')));

  const verdict = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/referral_set_fraud_status`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ p_referral_id: bobRow.id, p_status: 'review', p_note: 'e2e' }),
  });
  check('an admin can flag a referral for review', verdict.status < 300, `got ${verdict.status}`);
  const flagged = (await db.query('select fraud_status, reviewed_by, review_note from public.referrals where id = $1', [bobRow.id])).rows[0];
  check('the verdict records who made it', flagged.fraud_status === 'review' && flagged.reviewed_by === mallory.appId);

  await db.query('select public.refresh_referral_progress($1)', [made.campaign]);
  const afterJob = (await db.query('select fraud_status from public.referrals where id = $1', [bobRow.id])).rows[0];
  check('and the job does not overrule a person', afterJob.fraud_status === 'review');

  const paid = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/referral_mark_reward_paid`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ p_reward_id: reward.id, p_note: 'DC-0001' }),
  });
  check('an admin can record a reward as delivered', paid.status < 300, `got ${paid.status}`);
  const delivered = (await db.query('select paid_at, paid_note from public.referral_rewards where id = $1', [reward.id])).rows[0];
  check('with the reference kept alongside it', delivered.paid_at !== null && delivered.paid_note === 'DC-0001');

  const refreshed = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/referral_refresh_now`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ p_campaign_id: made.campaign }),
  });
  check('and can recompute the campaign on demand', refreshed.status < 300, `got ${refreshed.status}`);

  // 10. Partners are made from the admin screen, not from a migration.
  async function adminRpc(name, body) {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }

  const created = await adminRpc('referral_create_campaign', { p_partner_name: `E2E Partner ${stamp}` });
  const createdCode = created.body?.[0]?.code;
  if (created.body?.[0]?.id) made.extraCampaigns.push(created.body[0].id);
  check('an admin can start a partner and get a code back', created.status < 300 && /^[A-Z0-9]{6}$/.test(createdCode ?? ''), JSON.stringify(created.body));

  const ladder = (await db.query(
    'select metric, threshold, reward_value from public.referral_rewards where campaign_id = $1 order by metric, threshold',
    [created.body[0].id],
  )).rows;
  check('a new partner starts on the standard ladder', ladder.length === 3, JSON.stringify(ladder));

  const chosen = await adminRpc('referral_create_campaign', { p_partner_name: 'E2E Named', p_code: `E2EN${stamp.toString(36).toUpperCase().slice(-4)}` });
  if (chosen.body?.[0]?.id) made.extraCampaigns.push(chosen.body[0].id);
  check('and can choose a memorable code instead', chosen.status < 300 && Boolean(chosen.body?.[0]?.code), JSON.stringify(chosen.body));

  const taken = await adminRpc('referral_create_campaign', { p_partner_name: 'E2E Dup', p_code: CAMPAIGN_CODE });
  check('a code already in use is refused', taken.status >= 400, `got ${taken.status}`);

  const malformed = await adminRpc('referral_create_campaign', { p_partner_name: 'E2E Bad', p_code: 'has space' });
  check('so is one the link could never carry', malformed.status >= 400, `got ${malformed.status}`);

  const asNonAdmin = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/referral_create_campaign`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${bob.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_partner_name: 'not allowed' }),
  });
  check('a normal user cannot start a partner', asNonAdmin.status >= 400, `got ${asNonAdmin.status}`);

  // A new partner's code has to actually work as a link.
  const newcomer = await makeUser(6);
  made.users.push(newcomer);
  const throughNew = await claim(newcomer, createdCode, 'install-newcomer');
  check("a fresh partner's code attributes a real user", throughNew.body?.status === 'claimed', JSON.stringify(throughNew.body));

  // 11. Ending a deal stops new attributions and keeps the old ones.
  await adminRpc('referral_set_campaign_active', { p_campaign_id: created.body[0].id, p_active: false });
  const afterClose = await makeUser(7);
  made.users.push(afterClose);
  const refused = await claim(afterClose, createdCode, 'install-late');
  check('a closed link stops attributing anyone new', refused.body?.status === 'invalid_code', JSON.stringify(refused.body));
  const kept = (await db.query('select count(*)::int n from public.referrals where campaign_id = $1', [created.body[0].id])).rows[0].n;
  check('while everyone already counted stays counted', kept === 1);

  // 12. Ten partners means ten tallies, not one.
  const overview = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/referral_campaign_overview?select=*`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  // pg hands back bigints as strings and PostgREST as numbers, so compare as text.
  const byId = (id) => overview.find((entry) => String(entry.id) === String(id));
  const mine = byId(made.campaign);
  const theirs = byId(created.body[0].id);
  check('every partner appears with their own numbers', Boolean(mine) && Boolean(theirs));
  check('and those numbers do not bleed between them',
    mine?.joined === 4 && theirs?.joined === 1, JSON.stringify({ mine: mine?.joined, theirs: theirs?.joined }));
  check('a closed partner is still listed, marked closed', theirs?.active === false);

  const overviewAsBob = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/referral_campaign_overview?select=*`,
    { headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${bob.token}` } },
  ).then((r) => r.json());
  check('and none of it is visible to a normal user',
    Array.isArray(overviewAsBob) && overviewAsBob.length === 0, JSON.stringify(overviewAsBob).slice(0, 200));

  // 13. Each partner's terms are their own.
  await adminRpc('referral_upsert_reward', {
    p_campaign_id: created.body[0].id, p_metric: 'activated', p_threshold: 5,
    p_reward_type: 'cash', p_reward_value: 30,
  });
  const custom = (await db.query(
    "select reward_type, reward_value from public.referral_rewards where campaign_id = $1 and threshold = 5",
    [created.body[0].id],
  )).rows[0];
  check('a rung can be added on different terms', custom?.reward_type === 'cash' && Number(custom.reward_value) === 30);

  const rungId = (await db.query(
    'select id from public.referral_rewards where campaign_id = $1 and threshold = 5', [created.body[0].id],
  )).rows[0].id;
  await adminRpc('referral_delete_reward', { p_reward_id: rungId });
  const goneCount = (await db.query('select count(*)::int n from public.referral_rewards where id = $1', [rungId])).rows[0].n;
  check('and removed again while nobody has reached it', goneCount === 0);

  const earnedRung = await adminRpc('referral_delete_reward', { p_reward_id: reward.id });
  const stillThere = (await db.query('select count(*)::int n from public.referral_rewards where id = $1', [reward.id])).rows[0].n;
  check('but a rung already earned is a record, not a row to delete', earnedRung.status < 300 && stillThere === 1);

  // 14. Self-referral is refused outright.
  const carolOwn = (await db.query('select code from public.referral_codes where user_id = $1', [carol.appId])).rows[0]?.code;
  const selfClaim = await db.query('select public.claim_referral($1, $2) as status', [carol.appId, carolOwn]);
  check('claiming your own code is refused', selfClaim.rows[0].status === 'already_attributed');

  const fresh = await makeUser(5);
  made.users.push(fresh);
  const freshOwn = await db.query(
    `insert into public.referral_codes(user_id, code, campaign_id) values ($1, $2, $3) returning code`,
    [fresh.appId, `SELF${stamp.toString(36).toUpperCase().slice(-4)}`, made.campaign],
  );
  const selfOnly = await db.query('select public.claim_referral($1, $2) as status', [fresh.appId, freshOwn.rows[0].code]);
  check('an unattributed user cannot attribute themselves either', selfOnly.rows[0].status === 'self_referral', selfOnly.rows[0].status);

  // 15. Attribution does not reach back into old accounts.
  await db.query(`update public.users set created_at = now() - interval '90 days' where id = $1`, [fresh.appId]);
  const late = await db.query('select public.claim_referral($1, $2) as status', [fresh.appId, CAMPAIGN_CODE]);
  check('a code cannot be applied to a long-standing account', late.rows[0].status === 'too_late', late.rows[0].status);
} finally {
  // Everything this made, gone — including from the real pilot's tables.
  for (const user of made.users) {
    if (user?.appId) {
      await db.query('delete from public.user_activities where user_id = $1', [user.appId]);
      await db.query('delete from public.coupon where user_id = $1', [user.appId]);
      await db.query('delete from public.referrals where referred_user_id = $1 or direct_referrer_user_id = $1', [user.appId]);
      await db.query('delete from public.referral_codes where user_id = $1', [user.appId]);
    }
    // auth.users only nulls the link, so the app-side row has to go too.
    if (user?.appId) await db.query('delete from public.users where id = $1', [user.appId]);
    if (user?.id) await db.query('delete from auth.users where id = $1', [user.id]);
  }
  for (const id of [made.campaign, ...made.extraCampaigns].filter(Boolean)) {
    await db.query('delete from public.referral_rewards where campaign_id = $1', [id]);
    await db.query('delete from public.referral_codes where campaign_id = $1', [id]);
    await db.query('delete from public.referrals where campaign_id = $1', [id]);
    await db.query('delete from public.referral_campaigns where id = $1', [id]);
  }
  await db.end();
}

console.log(failures ? `\n${failures} failed\n` : '\nall passed\n');
process.exit(failures ? 1 : 0);
