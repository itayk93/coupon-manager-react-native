/**
 * Break-glass for a lost authenticator phone.
 *
 * The admin panel asks for a TOTP code, and losing the phone that generates it
 * means losing the panel. This deletes the enrolled factor with the service role
 * key, so the next visit to the panel starts enrollment again with a fresh QR.
 *
 * The service role key is the recovery credential here — there are no one-time
 * backup codes. Run it from a machine that already holds the key, never from CI.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/admin-mfa-recovery.mjs --email you@example.com --list
 *   ... --email you@example.com --reset
 */
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : args[index + 1] ?? true;
};

const email = flag('email');
const reset = args.includes('--reset');
const list = args.includes('--list') || !reset;

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
if (typeof email !== 'string') throw new Error('--email <address> is required');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

// The admin API has no lookup-by-email, so the page is walked until the address
// turns up. A missing account must be a hard stop: silently resetting nobody
// reads as success and leaves the real admin still locked out.
let authUser = null;
for (let page = 1; page <= 20 && !authUser; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  authUser = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  if (data.users.length < 200) break;
}
if (!authUser) throw new Error(`No auth user found for ${email}`);

const { data: factorData, error: factorError } = await supabase.auth.admin.mfa.listFactors({
  userId: authUser.id,
});
if (factorError) throw factorError;

const factors = factorData?.factors ?? [];
console.log(`${email} → auth user ${authUser.id}`);
if (factors.length === 0) {
  console.log('No MFA factors enrolled. The next admin-panel visit will start enrollment.');
  process.exit(0);
}

for (const factor of factors) {
  console.log(`  ${factor.id}  ${factor.factor_type}  ${factor.status}  ${factor.friendly_name ?? ''}`);
}

if (list && !reset) {
  console.log('\nRun again with --reset to delete these factors.');
  process.exit(0);
}

for (const factor of factors) {
  const { error } = await supabase.auth.admin.mfa.deleteFactor({
    userId: authUser.id,
    id: factor.id,
  });
  if (error) throw error;
  console.log(`Deleted factor ${factor.id}`);
}

console.log('\nDone. Open the admin panel to enroll a new authenticator, and save the manual key this time.');
