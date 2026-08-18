// Server-side request validation. The primary SSRF vector (attacker-supplied
// URL) is already absent from this codebase; this adds defense-in-depth for
// env-driven outbound URLs. Internal/loopback/metadata ranges and non-http(s)
// schemes are rejected, and only hosts on the allowlist are permitted.
//
// Configure SSRF_ALLOWED_HOSTS as a comma-separated list, e.g.
//   SSRF_ALLOWED_HOSTS=api.openai.com,api.brevo.com
// When unset, the check fails closed by returning false for every host.

const PRIVATE_IP_PATTERN =
  /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:)/i;

export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    PRIVATE_IP_PATTERN.test(host)
  );
}

export function isAllowedOutboundUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (!url.hostname || isPrivateHostname(url.hostname)) return false;

  const raw = Deno.env.get('SSRF_ALLOWED_HOSTS')?.trim();
  if (!raw) return false;

  const allowed = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return allowed.some((entry) => {
    if (entry.startsWith('*.')) {
      const suffix = entry.slice(1);
      return url.hostname.toLowerCase().endsWith(suffix);
    }
    return url.hostname.toLowerCase() === entry;
  });
}

/** Thin wrapper around fetch that refuses disallowed URLs and redirects. */
export async function safeFetch(rawUrl: string, init?: RequestInit): Promise<Response> {
  if (!isAllowedOutboundUrl(rawUrl)) {
    throw new Error(`Outbound URL is not allowed: ${rawUrl}`);
  }
  return fetch(rawUrl, { ...init, redirect: 'error' });
}
