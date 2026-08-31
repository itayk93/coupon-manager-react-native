/**
 * The rules an open share link lives by on the device.
 *
 * An open link is the only credential in the app that is handed to a person
 * rather than issued to an account: whoever holds the token is the recipient.
 * That is the whole point — you cannot AirDrop a coupon to someone whose email
 * you would have had to type first — and it is also why everything here is
 * strict about shape. A token that does not look exactly like the UUID the
 * server minted is not worth a round trip.
 *
 * Kept free of React Native and storage APIs so it can be tested directly.
 */

export const SHARE_LINK_BASE_URL = "https://coupons.itaykarkason.com";

/** Matches the server's 24-hour TTL. Used only to explain the link to its owner. */
export const SHARE_LINK_TTL_MS = 24 * 60 * 60 * 1000;

const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function shareLinkUrl(token: string): string {
  return `${SHARE_LINK_BASE_URL}/s/${token}`;
}

/**
 * The token inside `/s/<uuid>`, wherever the link arrived from — a universal
 * link, a scanned QR code, a pasted URL, or the router handing over a param.
 */
export function shareTokenFromPath(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const candidate = (() => {
    if (TOKEN_PATTERN.test(trimmed)) return trimmed;
    // Accept full URLs and bare paths alike. A QR scanner hands back the whole
    // link; expo-router hands back just the segment.
    const withoutQuery = trimmed.split(/[?#]/)[0];
    const match = withoutQuery.match(/\/s\/([^/]+)\/?$/);
    return match ? match[1] : null;
  })();

  if (!candidate || !TOKEN_PATTERN.test(candidate)) return null;
  return candidate.toLowerCase();
}
