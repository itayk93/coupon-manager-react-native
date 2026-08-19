// One-click unsubscribe links, shared by every function that mails a user.
//
// The token is `base64url(payload).base64url(hmac)`, verified by
// manage-unsubscribe, which is reachable without a session because the link is
// clicked straight from an inbox.

const textEncoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

export async function createUnsubscribeToken(userId: number, email: string): Promise<string | null> {
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET');
  if (!secret) return null;
  const payload = JSON.stringify({ user_id: userId, email, type: 'unsubscribe' });
  return `${toBase64Url(textEncoder.encode(payload))}.${await signPayload(payload, secret)}`;
}

/** Null when UNSUBSCRIBE_SECRET or APP_BASE_URL is unset — callers omit the footer. */
export async function buildUnsubscribeUrl(userId: number, email: string): Promise<string | null> {
  const appBaseUrl = Deno.env.get('APP_BASE_URL');
  if (!appBaseUrl) return null;
  const token = await createUnsubscribeToken(userId, email);
  if (!token) return null;
  return `${appBaseUrl.replace(/\/$/, '')}/unsubscribe?token=${encodeURIComponent(token)}`;
}
