/**
 * Single source of truth for the caller's IP. Kept import-free so the RN-side
 * vitest suite (src/lib/extractClientIp.test.ts) can exercise it directly.
 */
export function extractClientIp(req: Request): string {
  // The hosted platform sits behind Cloudflare, which overwrites
  // cf-connecting-ip with the real client IP. This is only as trustworthy as
  // the ingress path: if an origin were reachable without Cloudflare in
  // front, this header would also be client-controlled. The admin IP
  // allowlist therefore stays an advisory layer on top of the JWT check,
  // never proof of origin.
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;
  // Fallback (self-host / local): proxies APPEND to x-forwarded-for, so the
  // right-most entry is the one the nearest proxy vouches for; the left-most
  // is whatever the client claimed. Best-effort only.
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const entries = forwarded.split(',').map((entry) => entry.trim()).filter(Boolean);
    const last = entries[entries.length - 1];
    if (last) return last;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}
