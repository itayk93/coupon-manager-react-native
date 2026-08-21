import pg from 'pg';
import crypto from 'node:crypto';

const fields = ['code', 'description', 'buyme_coupon_url', 'strauss_coupon_url', 'xgiftcard_coupon_url', 'xtra_coupon_url', 'cvv', 'card_exp'];
const oldKey = process.env.OLD_ENCRYPTION_KEY;
const newKey = process.env.NEW_ENCRYPTION_KEY;
if (!process.env.DATABASE_URL || !oldKey || !newKey) throw new Error('DATABASE_URL, OLD_ENCRYPTION_KEY and NEW_ENCRYPTION_KEY are required');

function decode(value) { return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }
function key(value) { const result = decode(value); if (result.length !== 32) throw new Error('Encryption key must be 32 bytes'); return result; }
function decrypt(value, rawKey) {
  if (!value?.startsWith('gAAAAA')) return value;
  const bytes = key(rawKey); const token = decode(value); const unsigned = token.subarray(0, -32); const signature = token.subarray(-32);
  const expected = crypto.createHmac('sha256', bytes.subarray(0, 16)).update(unsigned).digest();
  if (!crypto.timingSafeEqual(signature, expected)) throw new Error('Invalid token signature');
  const decipher = crypto.createDecipheriv('aes-128-cbc', bytes.subarray(16), token.subarray(9, 25));
  return Buffer.concat([decipher.update(token.subarray(25, -32)), decipher.final()]).toString('utf8');
}
function encrypt(value, rawKey) {
  if (!value) return value;
  const bytes = key(rawKey); const header = Buffer.alloc(25); header[0] = 0x80; header.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)), 1); crypto.randomFillSync(header, 9, 16);
  const cipher = crypto.createCipheriv('aes-128-cbc', bytes.subarray(16), header.subarray(9, 25));
  const unsigned = Buffer.concat([header, cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([unsigned, crypto.createHmac('sha256', bytes.subarray(0, 16)).update(unsigned).digest()]).toString('base64url');
}

const databaseUrl = new URL(process.env.DATABASE_URL.replace('postgresql+psycopg2:', 'postgresql:')); databaseUrl.searchParams.delete('sslmode');
const db = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  await db.query('begin');
  const rows = (await db.query(`select id, ${fields.join(',')} from public.coupon order by id for update`)).rows;
  let valuesRotated = 0;
  for (const row of rows) {
    const values = fields.map((field) => {
      if (!row[field]) return row[field];
      let plaintext;
      try { plaintext = decrypt(row[field], newKey); return row[field]; } catch { plaintext = decrypt(row[field], oldKey); }
      valuesRotated += 1; return encrypt(plaintext, newKey);
    });
    await db.query(`update public.coupon set ${fields.map((field, index) => `${field}=$${index + 1}`).join(',')} where id=$${fields.length + 1}`, [...values, row.id]);
  }
  const verify = (await db.query(`select id, ${fields.join(',')} from public.coupon`)).rows;
  for (const row of verify) for (const field of fields) if (row[field]) decrypt(row[field], newKey);
  await db.query(process.argv.includes('--dry-run') ? 'rollback' : 'commit');
  console.log(`${process.argv.includes('--dry-run') ? 'Dry run' : 'Rotation'} passed: ${rows.length} coupons, ${valuesRotated} values`);
} catch (error) {
  await db.query('rollback'); throw error;
} finally { await db.end(); }
