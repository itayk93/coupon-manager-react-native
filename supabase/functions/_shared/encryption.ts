const textEncoder = new TextEncoder();

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function isEncrypted(value: string): boolean {
  return value.startsWith('gAAAAA');
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = '';
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_');
}

function keyBytes(value: string, name: string): Uint8Array {
  const bytes = decodeBase64Url(value);
  if (bytes.length !== 32) throw new Error(`Invalid ${name}`);
  return bytes;
}

async function decryptWithKey(value: string, rawKey: string): Promise<string> {
  const bytes = keyBytes(rawKey, 'encryption key');
  const token = decodeBase64Url(value);
  if (token.length < 57 || token[0] !== 0x80) throw new Error('Invalid Fernet token');

  const signingKey = await crypto.subtle.importKey(
    'raw', bytes.slice(0, 16), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await crypto.subtle.verify('HMAC', signingKey, token.slice(-32), token.slice(0, -32));
  if (!valid) throw new Error('Invalid encrypted coupon value');

  const aesKey = await crypto.subtle.importKey('raw', bytes.slice(16), { name: 'AES-CBC' }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: token.slice(9, 25) }, aesKey, token.slice(25, -32));
  return new TextDecoder().decode(plaintext);
}

export async function encryptCouponValue(value: string): Promise<string> {
  if (!value) return value;
  const rawKey = Deno.env.get('ENCRYPTION_KEY');
  if (!rawKey) throw new Error('ENCRYPTION_KEY is not configured');
  const bytes = keyBytes(rawKey, 'ENCRYPTION_KEY');
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const header = new Uint8Array(25);
  header[0] = 0x80;
  new DataView(header.buffer).setBigUint64(1, timestamp, false);
  crypto.getRandomValues(header.subarray(9, 25));

  const aesKey = await crypto.subtle.importKey('raw', bytes.slice(16), { name: 'AES-CBC' }, false, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: header.slice(9, 25) }, aesKey, textEncoder.encode(value)
  ));
  const unsigned = new Uint8Array(header.length + encrypted.length);
  unsigned.set(header);
  unsigned.set(encrypted, header.length);
  const signingKey = await crypto.subtle.importKey(
    'raw', bytes.slice(0, 16), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', signingKey, unsigned));
  const token = new Uint8Array(unsigned.length + signature.length);
  token.set(unsigned);
  token.set(signature, unsigned.length);
  return encodeBase64Url(token);
}

export async function decryptCouponValue(value: string): Promise<string> {
  if (!isEncrypted(value)) return value;

  const keys = [Deno.env.get('ENCRYPTION_KEY'), Deno.env.get('ENCRYPTION_KEY_PREVIOUS')].filter(Boolean) as string[];
  if (!keys.length) throw new Error('ENCRYPTION_KEY is not configured');
  for (const key of keys) {
    try { return await decryptWithKey(value, key); } catch { /* try rollback key */ }
  }
  throw new Error('Unable to decrypt coupon value');
}

export const decryptCouponCode = decryptCouponValue;

export async function decryptCouponCodes(values: string[]): Promise<string[]> {
  return Promise.all(values.map((value) => decryptCouponValue(value)));
}
