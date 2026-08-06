const textEncoder = new TextEncoder();

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function isEncrypted(value: string): boolean {
  return value.startsWith('gAAAAA');
}

export async function decryptCouponCode(value: string): Promise<string> {
  if (!isEncrypted(value)) return value;

  const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY is not configured');

  const keyBytes = decodeBase64Url(encryptionKey);
  if (keyBytes.length !== 32) throw new Error('Invalid ENCRYPTION_KEY');

  const token = decodeBase64Url(value);
  if (token.length < 57 || token[0] !== 0x80) throw new Error('Invalid Fernet token');

  const signingKey = await crypto.subtle.importKey(
    'raw', keyBytes.slice(0, 16), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await crypto.subtle.verify(
    'HMAC', signingKey, token.slice(-32), token.slice(0, -32)
  );
  if (!valid) throw new Error('Invalid encrypted coupon code');

  const aesKey = await crypto.subtle.importKey(
    'raw', keyBytes.slice(16), { name: 'AES-CBC' }, false, ['decrypt']
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: token.slice(9, 25) },
    aesKey,
    token.slice(25, -32)
  );
  return new TextDecoder().decode(plaintext);
}

export async function decryptCouponCodes(values: string[]): Promise<string[]> {
  return Promise.all(values.map((value) => decryptCouponCode(value)));
}
