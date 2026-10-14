// One-click unsubscribe links, shared by every function that mails a user.
//
// The token is `base64url(payload).base64url(hmac)`, verified by
// manage-unsubscribe, which is reachable without a session because the link is
// clicked straight from an inbox.

import { unsubscribeUrl } from './appLinks.ts';

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

export async function createUnsubscribeToken(userPublicId: string, email: string, notificationType?: string): Promise<string | null> {
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET');
  if (!secret) return null;
  const payload = JSON.stringify({ user_public_id: userPublicId, email, type: 'unsubscribe', notification_type: notificationType });
  return `${toBase64Url(textEncoder.encode(payload))}.${await signPayload(payload, secret)}`;
}

/** Null when UNSUBSCRIBE_SECRET or APP_BASE_URL is unset — callers omit the footer. */
export async function buildUnsubscribeUrl(userPublicId: string, email: string, notificationType?: string): Promise<string | null> {
  const appBaseUrl = Deno.env.get('APP_BASE_URL');
  if (!appBaseUrl) return null;
  const token = await createUnsubscribeToken(userPublicId, email, notificationType);
  if (!token) return null;
  if (notificationType) {
    return `${appBaseUrl.replace(/\/+$/, '')}/notification-settings?unsubscribe_type=${encodeURIComponent(notificationType)}&token=${encodeURIComponent(token)}`;
  }
  return unsubscribeUrl(appBaseUrl, token);
}

/**
 * RFC 8058 one-click headers, for Gmail's and Yahoo's own unsubscribe button.
 *
 * Deliberately points at the edge function rather than the in-app page: the
 * mail client POSTs here unattended and needs a plain 2xx, not HTML. Typed
 * tokens stop only that email kind. The body link opens its switch in settings.
 *
 * Returns an empty object when the token cannot be signed, so a missing secret
 * degrades to "no headers" rather than a broken unsubscribe.
 */
export async function buildUnsubscribeHeaders(
  userPublicId: string,
  email: string,
  notificationType?: string,
): Promise<Record<string, string>> {
  const functionsBase = Deno.env.get('SUPABASE_URL');
  if (!functionsBase) return {};
  const token = await createUnsubscribeToken(userPublicId, email, notificationType);
  if (!token) return {};
  const endpoint =
    `${functionsBase.replace(/\/$/, '')}/functions/v1/manage-unsubscribe` +
    `?token=${encodeURIComponent(token)}`;
  return {
    'List-Unsubscribe': `<${endpoint}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
