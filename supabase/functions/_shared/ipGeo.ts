/**
 * Resolve a public IP to a coarse location (city / region) plus its network
 * (ISP / ASN) for the referral fraud signal.
 *
 * Free, no infrastructure: ipwho.is needs no key and is the default. If an
 * IPINFO_TOKEN secret is present we prefer ipinfo.io (more accurate, 50k/mo
 * free) and fall back to ipwho.is on any failure. Both down -> null, and the
 * caller marks the IP as failed so it is not retried every run.
 */

export type IpGeo = {
  city: string | null;
  region: string | null;
  country_code: string | null;
  isp: string | null;
  asn: string | null;
  source: "ipinfo" | "ipwho";
};

const TIMEOUT_MS = 4000;

async function getJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "error" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** ipinfo's `org` is "AS#### Provider Name"; split it into the two fields. */
function parseOrg(org?: string): { asn: string | null; isp: string | null } {
  const match = /^(AS\d+)\s+(.*)$/.exec(org ?? "");
  if (match) return { asn: match[1], isp: match[2] };
  return { asn: null, isp: org || null };
}

export async function resolveIp(ip: string): Promise<IpGeo | null> {
  const token = Deno.env.get("IPINFO_TOKEN");

  if (token) {
    const d = await getJson(`https://ipinfo.io/${ip}?token=${token}`);
    if (d && !d.bogon && (d.city || d.region)) {
      const { asn, isp } = parseOrg(d.org);
      return {
        city: d.city ?? null,
        region: d.region ?? null,
        country_code: d.country ?? null,
        isp,
        asn,
        source: "ipinfo",
      };
    }
  }

  const w = await getJson(`https://ipwho.is/${ip}`);
  if (w && w.success !== false && (w.city || w.region)) {
    return {
      city: w.city ?? null,
      region: w.region ?? null,
      country_code: w.country_code ?? null,
      isp: w.connection?.isp ?? null,
      asn: w.connection?.asn ? `AS${w.connection.asn}` : null,
      source: "ipwho",
    };
  }

  return null;
}
